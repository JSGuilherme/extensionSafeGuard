import { LocalApiClient } from "./api/client.js";
import { API_AUTH_MODE, API_BASE_URL } from "./config.js";
import { ApiClientError } from "./types/api.js";
import type { RuntimeRequest, RuntimeResponse } from "./types/messages.js";

interface SessionState {
  token: string;
  expiresAtUnix: number;
  ttlSecs: number;
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
      ttlSecs: fromStorage?.ttlSecs
    });
    if (fromStorage && typeof fromStorage.token === "string") {
      if (!isSessionExpired(fromStorage.expiresAtUnix)) {
        sessionState = fromStorage;
        console.info("[cofre-bg] initializeSession: sessao restaurada com sucesso.", {
          expiresAtUnix: sessionState.expiresAtUnix,
          ttlSecs: sessionState.ttlSecs
        });
        return;
      }
      console.info("[cofre-bg] initializeSession: sessao encontrada mas expirou. Limpando estado.", {
        expiresAtUnix: fromStorage.expiresAtUnix
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
      sessionState = {
        token: createdVault.session_token,
        expiresAtUnix: createdVault.expires_at_unix,
        ttlSecs: createdVault.ttl_secs
      };
      await chrome.storage.session.set({ [SESSION_KEY]: sessionState });

      return {
        ok: true,
        data: {
          expiresAtUnix: createdVault.expires_at_unix,
          ttlSecs: createdVault.ttl_secs
        }
      };
    }

    if (message.type === "GET_SESSION_STATUS") {
      console.info("[cofre-bg] GET_SESSION_STATUS: consultando estado local da sessao.", {
        hasSession: Boolean(sessionState),
        expiresAtUnix: sessionState?.expiresAtUnix,
        ttlSecs: sessionState?.ttlSecs
      });
      if (!sessionState) {
        console.info("[cofre-bg] GET_SESSION_STATUS: nenhuma sessao carregada.");
        return { ok: true, data: { unlocked: false } };
      }

      if (isSessionExpired(sessionState.expiresAtUnix)) {
        console.info("[cofre-bg] GET_SESSION_STATUS: sessao expirada antes da resposta. Limpando estado.", {
          expiresAtUnix: sessionState.expiresAtUnix
        });
        await clearSessionState();
        return { ok: true, data: { unlocked: false } };
      }

      console.info("[cofre-bg] GET_SESSION_STATUS: sessao valida e ativa.");
      return {
        ok: true,
        data: {
          unlocked: true,
          expiresAtUnix: sessionState.expiresAtUnix,
          ttlSecs: sessionState.ttlSecs
        }
      };
    }

    if (message.type === "UNLOCK") {
      console.info("[cofre-bg] UNLOCK: iniciando unlock via API local.");
      const unlocked = await apiClient.unlock({ master_password: message.masterPassword });
      sessionState = {
        token: unlocked.session_token,
        expiresAtUnix: unlocked.expires_at_unix,
        ttlSecs: unlocked.ttl_secs
      };
      await chrome.storage.session.set({ [SESSION_KEY]: sessionState });
      console.info("[cofre-bg] UNLOCK: sessao persistida.", {
        expiresAtUnix: sessionState.expiresAtUnix,
        ttlSecs: sessionState.ttlSecs
      });

      return {
        ok: true,
        data: {
          expiresAtUnix: unlocked.expires_at_unix,
          ttlSecs: unlocked.ttl_secs
        }
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
      console.info("[cofre-bg] LIST_ENTRIES: API retornou entradas.", {
        count: listed.entries.length
      });
      return {
        ok: true,
        data: { entries: listed.entries }
      };
    }

    if (message.type === "CREATE_ENTRY") {
      const activeSession = await requireSession();
      const result = await apiClient.createEntry(activeSession.token, {
        servico: message.service,
        usuario: message.username,
        password: message.password,
        url: message.url,
        notes: message.notes
      });

      return {
        ok: true,
        data: {
          entryId: result.entryId,
          created: result.created
        }
      };
    }

    if (message.type === "GET_ENTRY_PASSWORD") {
      console.info("[cofre-bg] Iniciando GET_ENTRY_PASSWORD.");
      const activeSession = await requireSession();
      console.info("[cofre-bg] Sessao valida para GET_ENTRY_PASSWORD.");
      const passwordResult = await apiClient.getEntryPassword(activeSession.token, message.entryId);
      console.info("[cofre-bg] Senha obtida da API local.");
      const autofillResult = await sendAutofillToActiveTab({
        password: passwordResult.senha,
        username: message.username
      });
      console.info("[cofre-bg] Resultado envio autofill para aba ativa:", autofillResult);
      return {
        ok: true,
        data: {
          filled: autofillResult.filled,
          reason: autofillResult.reason,
          reasonDetail: autofillResult.reasonDetail
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
      return {
        ok: true,
        data: {
          password: passwordResult.senha
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
      if (error.code === "SESSION_EXPIRED") {
        await clearSessionState();
      }
      return {
        ok: false,
        error: { code: error.code, message: error.message }
      };
    }

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

  if (isSessionExpired(sessionState.expiresAtUnix)) {
    console.warn("[cofre-bg] requireSession: sessionState expirou. Limpando estado.", {
      expiresAtUnix: sessionState.expiresAtUnix
    });
    await clearSessionState();
    throw new ApiClientError("SESSION_EXPIRED", "Sessao expirada. Faca unlock novamente.");
  }

  return sessionState;
}

function isSessionExpired(expiresAtUnix: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAtUnix;
}

async function clearSessionState(): Promise<void> {
  console.info("[cofre-bg] clearSessionState: limpando sessao da memoria e storage.session.");
  sessionState = null;
  await chrome.storage.session.remove(SESSION_KEY);
}

async function sendAutofillToActiveTab(payload: {
  username?: string;
  password: string;
}): Promise<{ filled: boolean; reason?: string; reasonDetail?: string }> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    return { filled: false, reason: "ACTIVE_TAB_NOT_FOUND", reasonDetail: "Aba ativa nao encontrada." };
  }

  try {
    const response = (await chrome.tabs.sendMessage(activeTab.id, {
      type: "AUTOFILL_CREDENTIAL",
      payload
    })) as { filled?: boolean; reason?: string; reasonDetail?: string } | undefined;

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
      reasonDetail: response.reasonDetail
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
        })) as { filled?: boolean; reason?: string; reasonDetail?: string } | undefined;

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
          reasonDetail: retryResponse.reasonDetail
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
