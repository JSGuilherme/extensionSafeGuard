import { LocalApiClient } from "./api/client.js";
import { API_AUTH_MODE, API_BASE_URL } from "./config.js";
import { ApiClientError } from "./types/api.js";
import type { TouchSessionResponse, UnlockResponse } from "./types/api.js";
import type { RuntimeRequest, RuntimeResponse } from "./types/messages.js";

interface SessionState {
  token: string;
  expiresAtUnix: number;
  maxExpiresAtUnix: number;
  ttlSecs: number;
  maxTtlSecs: number;
}

type PostActionReason =
  | "NOT_CONFIGURED"
  | "PARSE_INVALID"
  | "AUTOFILL_FAILED"
  | "ELEMENT_NOT_FOUND"
  | "CLICK_ERROR"
  | "EXECUTED";

interface AutofillPostAction {
  type: "click";
  selector: string;
}

interface AutofillResponsePayload {
  filled?: boolean;
  reason?: string;
  reasonDetail?: string;
  postActionAttempted?: boolean;
  postActionExecuted?: boolean;
  postActionReason?: PostActionReason;
}

const apiClient = new LocalApiClient({
  baseUrl: API_BASE_URL,
  authMode: API_AUTH_MODE
});

const SESSION_KEY = "cofre_session";
let sessionState: SessionState | null = null;

const initializePromise = initializeSession();

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("Falha inesperada ao tratar mensagem no background:", error);
      sendResponse({
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "Falha interna no background da extensao."
        }
      });
    });
  return true;
});

async function initializeSession(): Promise<void> {
  console.info("[cofre-bg] initializeSession: iniciando leitura da storage.session.");
  try {
    const result = await chrome.storage.session.get(SESSION_KEY);
    const fromStorage = result[SESSION_KEY] as SessionState | undefined;
    console.info("[cofre-bg] initializeSession: valor bruto encontrado na storage.session.", {
      hasSession: Boolean(fromStorage),
      hasToken: Boolean(fromStorage?.token),
      expiresAtUnix: fromStorage?.expiresAtUnix,
      maxExpiresAtUnix: fromStorage?.maxExpiresAtUnix,
      ttlSecs: fromStorage?.ttlSecs
    });
    const restoredSession = normalizeSessionState(fromStorage);
    if (restoredSession) {
      if (!isSessionExpired(restoredSession.expiresAtUnix, restoredSession.maxExpiresAtUnix)) {
        sessionState = restoredSession;
        console.info("[cofre-bg] initializeSession: sessao restaurada com sucesso.", {
          expiresAtUnix: sessionState.expiresAtUnix,
          maxExpiresAtUnix: sessionState.maxExpiresAtUnix,
          ttlSecs: sessionState.ttlSecs
        });
        return;
      }
      console.info("[cofre-bg] initializeSession: sessao encontrada mas expirou. Limpando estado.", {
        expiresAtUnix: restoredSession.expiresAtUnix,
        maxExpiresAtUnix: restoredSession.maxExpiresAtUnix
      });
      await clearSessionState();
    }
  } catch {
    console.warn("[cofre-bg] initializeSession: falha ao ler storage.session.");
    sessionState = null;
  }
}

async function handleMessage(message: RuntimeRequest): Promise<RuntimeResponse<unknown>> {
  await initializePromise;

  try {
    if (message.type === "HEALTH_CHECK") {
      await apiClient.health();
      return { ok: true, data: { status: "ok" } };
    }

    if (message.type === "GET_VAULT_STATUS") {
      console.info("[cofre-bg] GET_VAULT_STATUS: consultando status do cofre na API local.");
      const vaultStatus = await apiClient.getVaultStatus();
      console.info("[cofre-bg] GET_VAULT_STATUS: resposta recebida.", vaultStatus);
      return {
        ok: true,
        data: {
          exists: vaultStatus.exists
        }
      };
    }

    if (message.type === "CREATE_VAULT") {
      const createdVault = await apiClient.createVault({ master_password: message.masterPassword });
      sessionState = sessionStateFromUnlock(createdVault);
      await persistSessionState(sessionState);

      return {
        ok: true,
        data: sessionUiResult(sessionState)
      };
    }

    if (message.type === "GET_SESSION_STATUS") {
      console.info("[cofre-bg] GET_SESSION_STATUS: consultando estado local da sessao.", {
        hasSession: Boolean(sessionState),
        expiresAtUnix: sessionState?.expiresAtUnix,
        maxExpiresAtUnix: sessionState?.maxExpiresAtUnix,
        ttlSecs: sessionState?.ttlSecs
      });
      if (!sessionState) {
        console.info("[cofre-bg] GET_SESSION_STATUS: nenhuma sessao carregada.");
        return { ok: true, data: { unlocked: false } };
      }

      if (isSessionExpired(sessionState.expiresAtUnix, sessionState.maxExpiresAtUnix)) {
        console.info("[cofre-bg] GET_SESSION_STATUS: sessao expirada antes da resposta. Limpando estado.", {
          expiresAtUnix: sessionState.expiresAtUnix,
          maxExpiresAtUnix: sessionState.maxExpiresAtUnix
        });
        await clearSessionState();
        return { ok: true, data: { unlocked: false } };
      }

      const activeSession = await refreshSessionActivity(sessionState);
      console.info("[cofre-bg] GET_SESSION_STATUS: sessao valida e ativa.");
      return {
        ok: true,
        data: {
          unlocked: true,
          ...sessionUiResult(activeSession)
        }
      };
    }

    if (message.type === "UNLOCK") {
      console.info("[cofre-bg] UNLOCK: iniciando unlock via API local.");
      const unlocked = await apiClient.unlock({ master_password: message.masterPassword });
      sessionState = sessionStateFromUnlock(unlocked);
      await persistSessionState(sessionState);
      console.info("[cofre-bg] UNLOCK: sessao persistida.", {
        expiresAtUnix: sessionState.expiresAtUnix,
        maxExpiresAtUnix: sessionState.maxExpiresAtUnix,
        ttlSecs: sessionState.ttlSecs
      });

      return {
        ok: true,
        data: sessionUiResult(sessionState)
      };
    }

    if (message.type === "LIST_ENTRIES") {
      console.info("[cofre-bg] LIST_ENTRIES: requisicao recebida.");
      const activeSession = await requireSession();
      console.info("[cofre-bg] LIST_ENTRIES: sessao valida confirmada.", {
        expiresAtUnix: activeSession.expiresAtUnix,
        ttlSecs: activeSession.ttlSecs
      });
      const listed = await apiClient.listEntries(activeSession.token);
      await refreshSessionActivity(activeSession);
      console.info("[cofre-bg] LIST_ENTRIES: API retornou entradas.", {
        count: listed.entries.length
      });
      return {
        ok: true,
        data: { entries: listed.entries }
      };
    }

    if (message.type === "CREATE_ENTRY") {
      console.info("[cofre-bg] CREATE_ENTRY: requisicao recebida.", {
        service: message.service,
        hasUsername: Boolean(message.username),
        hasPassword: Boolean(message.password)
      });
      const activeSession = await requireSession();
      const result = await apiClient.createEntry(activeSession.token, {
        servico: message.service,
        usuario: message.username,
        senha: message.password,
        url: message.url,
        notas: message.notes
      });
      await refreshSessionActivity(activeSession);

      console.info("[cofre-bg] CREATE_ENTRY: API retornou sucesso.", {
        entryId: result.entryId,
        created: result.created
      });

      return {
        ok: true,
        data: {
          entryId: result.entryId,
          created: result.created
        }
      };
    }

    if (message.type === "EDIT_ENTRY") {
      console.info("[cofre-bg] EDIT_ENTRY: requisicao recebida.", {
        entryId: message.entryId,
        hasService: Boolean(message.service),
        hasUsername: Boolean(message.username),
        hasPassword: Boolean(message.password),
        hasUrl: Boolean(message.url),
        hasNotes: Boolean(message.notes)
      });
      const activeSession = await requireSession();
      const result = await apiClient.editEntry(activeSession.token, message.entryId, {
        servico: message.service,
        usuario: message.username,
        senha: message.password,
        url: message.url,
        notas: message.notes
      });
      await refreshSessionActivity(activeSession);

      console.info("[cofre-bg] EDIT_ENTRY: API retornou sucesso.", {
        entryId: result.entryId,
        created: result.created
      });

      return {
        ok: true,
        data: {
          entryId: result.entryId,
          created: result.created
        }
      };
    }

    if (message.type === "DELETE_ENTRY") {
      console.info("[cofre-bg] DELETE_ENTRY: requisicao recebida.", {
        entryId: message.entryId
      });
      const activeSession = await requireSession();
      await apiClient.deleteEntry(activeSession.token, message.entryId);
      await refreshSessionActivity(activeSession);
      console.info("[cofre-bg] DELETE_ENTRY: exclusao concluida.");
      return {
        ok: true,
        data: {
          deleted: true
        }
      };
    }

    if (message.type === "GET_ENTRY_PASSWORD") {
      console.info("[cofre-bg] Iniciando GET_ENTRY_PASSWORD.");
      const activeSession = await requireSession();
      console.info("[cofre-bg] Sessao valida para GET_ENTRY_PASSWORD.");
      const passwordResult = await apiClient.getEntryPassword(activeSession.token, message.entryId);
      const notesResult = await getEntryNotesSafely(activeSession.token, message.entryId);
      await refreshSessionActivity(activeSession);
      const postAction = parseNotesPostAction(notesResult.notes);
      console.info("[cofre-bg] Senha obtida da API local.");
      const autofillResult = await sendAutofillToActiveTab({
        password: passwordResult.senha,
        username: message.username,
        postAction: postAction.actions
      });
      console.info("[cofre-bg] Resultado envio autofill para aba ativa:", autofillResult);

      const postActionReason =
        postAction.actions != null
          ? autofillResult.postActionReason
          : postAction.parseReason !== "NOT_CONFIGURED"
            ? postAction.parseReason
            : autofillResult.postActionReason;

      return {
        ok: true,
        data: {
          filled: autofillResult.filled,
          reason: autofillResult.reason,
          reasonDetail: autofillResult.reasonDetail,
          postActionAttempted: autofillResult.postActionAttempted,
          postActionExecuted: autofillResult.postActionExecuted,
          postActionReason
        }
      };
    }

    if (message.type === "GET_ENTRY_PASSWORD_VALUE") {
      console.info("[cofre-bg] GET_ENTRY_PASSWORD_VALUE: requisicao recebida.", {
        entryId: message.entryId
      });
      const activeSession = await requireSession();
      console.info("[cofre-bg] GET_ENTRY_PASSWORD_VALUE: sessao valida confirmada.");
      const passwordResult = await apiClient.getEntryPassword(activeSession.token, message.entryId);
      await refreshSessionActivity(activeSession);
      return {
        ok: true,
        data: {
          password: passwordResult.senha
        }
      };
    }

    if (message.type === "GET_ENTRY_NOTES") {
      console.info("[cofre-bg] GET_ENTRY_NOTES: requisicao recebida.", {
        entryId: message.entryId
      });
      const activeSession = await requireSession();
      console.info("[cofre-bg] GET_ENTRY_NOTES: sessao valida confirmada.");
      const notesResult = await apiClient.getEntryNotes(activeSession.token, message.entryId);
      await refreshSessionActivity(activeSession);
      return {
        ok: true,
        data: {
          notes: notesResult.notas
        }
      };
    }

    if (message.type === "LOCK_SESSION") {
      if (sessionState) {
        try {
          await apiClient.lockSession(sessionState.token);
        } catch (error) {
          if (!(error instanceof ApiClientError) || error.code !== "NOT_FOUND") {
            throw error;
          }
        }
      }

      await clearSessionState();
      return { ok: true, data: { locked: true } };
    }

    return { ok: false, error: { code: "UNKNOWN_ACTION", message: "Acao nao suportada." } };
  } catch (error) {
    if (error instanceof ApiClientError) {
      console.warn("[cofre-bg] handleMessage: ApiClientError capturado.", {
        code: error.code,
        status: error.status,
        message: error.message,
        action: message.type
      });
      if (error.code === "SESSION_EXPIRED") {
        await clearSessionState();
      }
      return {
        ok: false,
        error: { code: error.code, message: error.message }
      };
    }

    console.error("[cofre-bg] handleMessage: erro nao mapeado.", {
      action: message.type,
      error
    });

    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "Erro inesperado ao processar operacao da extensao."
      }
    };
  }
}

async function requireSession(): Promise<SessionState> {
  if (!sessionState) {
    console.warn("[cofre-bg] requireSession: sessionState ausente.");
    throw new ApiClientError("SESSION_EXPIRED", "Sessao expirada. Faca unlock novamente.");
  }

  if (isSessionExpired(sessionState.expiresAtUnix, sessionState.maxExpiresAtUnix)) {
    console.warn("[cofre-bg] requireSession: sessionState expirou. Limpando estado.", {
      expiresAtUnix: sessionState.expiresAtUnix,
      maxExpiresAtUnix: sessionState.maxExpiresAtUnix
    });
    await clearSessionState();
    throw new ApiClientError("SESSION_EXPIRED", "Sessao expirada. Faca unlock novamente.");
  }

  return sessionState;
}

function normalizeSessionState(value: SessionState | undefined): SessionState | null {
  if (
    !value ||
    typeof value.token !== "string" ||
    typeof value.expiresAtUnix !== "number" ||
    typeof value.ttlSecs !== "number"
  ) {
    return null;
  }

  const maxExpiresAtUnix =
    typeof value.maxExpiresAtUnix === "number" ? value.maxExpiresAtUnix : Number.MAX_SAFE_INTEGER;
  const maxTtlSecs = typeof value.maxTtlSecs === "number" ? value.maxTtlSecs : value.ttlSecs;

  return {
    token: value.token,
    expiresAtUnix: value.expiresAtUnix,
    maxExpiresAtUnix,
    ttlSecs: value.ttlSecs,
    maxTtlSecs
  };
}

function sessionStateFromUnlock(response: UnlockResponse): SessionState {
  return {
    token: response.session_token,
    expiresAtUnix: response.expires_at_unix,
    maxExpiresAtUnix: response.max_expires_at_unix,
    ttlSecs: response.ttl_secs,
    maxTtlSecs: response.max_ttl_secs
  };
}

function sessionStateFromTouch(token: string, response: TouchSessionResponse): SessionState {
  return {
    token,
    expiresAtUnix: response.expires_at_unix,
    maxExpiresAtUnix: response.max_expires_at_unix,
    ttlSecs: response.ttl_secs,
    maxTtlSecs: response.max_ttl_secs
  };
}

function sessionUiResult(state: SessionState): {
  expiresAtUnix: number;
  maxExpiresAtUnix: number;
  ttlSecs: number;
  maxTtlSecs: number;
} {
  return {
    expiresAtUnix: state.expiresAtUnix,
    maxExpiresAtUnix: state.maxExpiresAtUnix,
    ttlSecs: state.ttlSecs,
    maxTtlSecs: state.maxTtlSecs
  };
}

async function refreshSessionActivity(activeSession: SessionState): Promise<SessionState> {
  const touched = await apiClient.touchSession(activeSession.token);
  const refreshedSession = sessionStateFromTouch(activeSession.token, touched);
  sessionState = refreshedSession;
  await persistSessionState(refreshedSession);
  return refreshedSession;
}

async function persistSessionState(state: SessionState): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: state });
}

function isSessionExpired(expiresAtUnix: number, maxExpiresAtUnix: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAtUnix || now >= maxExpiresAtUnix;
}

async function clearSessionState(): Promise<void> {
  console.info("[cofre-bg] clearSessionState: limpando sessao da memoria e storage.session.");
  sessionState = null;
  await chrome.storage.session.remove(SESSION_KEY);
}

async function getEntryNotesSafely(
  sessionToken: string,
  entryId: string
): Promise<{ notes: string | null }> {
  try {
    const notesResult = await apiClient.getEntryNotes(sessionToken, entryId);
    return { notes: notesResult.notas };
  } catch (error) {
    if (error instanceof ApiClientError) {
      console.warn("[cofre-bg] Nao foi possivel obter notas para post-action.", {
        entryId,
        code: error.code,
        status: error.status
      });
    } else {
      console.warn("[cofre-bg] Nao foi possivel obter notas para post-action.", {
        entryId,
        error
      });
    }
    return { notes: null };
  }
}

function parseNotesPostAction(notes: string | null): {
  actions?: AutofillPostAction[];
  parseReason: PostActionReason;
} {
  if (!notes) {
    return { parseReason: "NOT_CONFIGURED" };
  }

  const trimmed = notes.trim();
  if (!trimmed) {
    return { parseReason: "NOT_CONFIGURED" };
  }

  const commandPattern = /\s*click\(\s*(['"])(.*?)\1\s*\)\s*;?/iy;
  const actions: AutofillPostAction[] = [];
  let offset = 0;

  while (offset < trimmed.length) {
    commandPattern.lastIndex = offset;
    const match = commandPattern.exec(trimmed);
    if (!match || match.index !== offset) {
      return { parseReason: "PARSE_INVALID" };
    }

    const selector = match[2]?.trim();
    if (!selector) {
      return { parseReason: "PARSE_INVALID" };
    }

    actions.push({
      type: "click",
      selector
    });
    offset = commandPattern.lastIndex;
  }

  return {
    actions,
    parseReason: "EXECUTED"
  };
}

async function sendAutofillToActiveTab(payload: {
  username?: string;
  password: string;
  postAction?: AutofillPostAction[];
}): Promise<{
  filled: boolean;
  reason?: string;
  reasonDetail?: string;
  postActionAttempted?: boolean;
  postActionExecuted?: boolean;
  postActionReason?: PostActionReason;
}> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    return { filled: false, reason: "ACTIVE_TAB_NOT_FOUND", reasonDetail: "Aba ativa nao encontrada." };
  }

  try {
    await ensureLatestContentScript(activeTab.id);
    const response = (await chrome.tabs.sendMessage(activeTab.id, {
      type: "AUTOFILL_CREDENTIAL",
      payload
    })) as AutofillResponsePayload | undefined;

    if (!response) {
      return {
        filled: false,
        reason: "CONTENT_SCRIPT_NO_RESPONSE",
        reasonDetail: "Content script nao retornou payload de resposta."
      };
    }

    return {
      filled: Boolean(response.filled),
      reason: response.reason,
      reasonDetail: response.reasonDetail,
      postActionAttempted: response.postActionAttempted,
      postActionExecuted: response.postActionExecuted,
      postActionReason: response.postActionReason
    };
  } catch (error) {
    const reasonDetail = error instanceof Error ? error.message : "Falha desconhecida ao enviar mensagem para a aba.";

    if (error instanceof Error && error.message.includes("Receiving end does not exist")) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content.js"]
        });

        const retryResponse = (await chrome.tabs.sendMessage(activeTab.id, {
          type: "AUTOFILL_CREDENTIAL",
          payload
        })) as AutofillResponsePayload | undefined;

        if (!retryResponse) {
          return {
            filled: false,
            reason: "CONTENT_SCRIPT_NO_RESPONSE",
            reasonDetail: "Content script foi injetado, mas nao respondeu ao comando de autofill."
          };
        }

        return {
          filled: Boolean(retryResponse.filled),
          reason: retryResponse.reason,
          reasonDetail: retryResponse.reasonDetail,
          postActionAttempted: retryResponse.postActionAttempted,
          postActionExecuted: retryResponse.postActionExecuted,
          postActionReason: retryResponse.postActionReason
        };
      } catch (injectError) {
        const injectDetail = injectError instanceof Error ? injectError.message : "Falha ao injetar content script.";
        return {
          filled: false,
          reason: "CONTENT_SCRIPT_UNREACHABLE",
          reasonDetail: `Content script indisponivel e injecao falhou: ${injectDetail}`
        };
      }
    }

    return { filled: false, reason: "CONTENT_SCRIPT_UNREACHABLE", reasonDetail };
  }
}

async function ensureLatestContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (error) {
    console.warn("[cofre-bg] Nao foi possivel reinjetar content script antes do autofill.", {
      tabId,
      error
    });
  }
}
