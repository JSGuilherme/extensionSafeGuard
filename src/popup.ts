import type { EntrySummary } from "./types/api.js";
import type {
    GetPasswordValueUiResult,
    GetPasswordUiResult,
    ListEntriesUiResult,
    RuntimeRequest,
    RuntimeResponse,
    SessionStatusUiResult,
    UnlockUiResult
} from "./types/messages.js";

const unlockBtn = mustGetElement<HTMLButtonElement>("unlock-btn");
const refreshBtn = mustGetElement<HTMLButtonElement>("refresh-btn");
const lockBtn = mustGetElement<HTMLButtonElement>("lock-btn");
const passwordInput = mustGetElement<HTMLInputElement>("master-password");
const entriesList = mustGetElement<HTMLUListElement>("entries-list");
const statusText = mustGetElement<HTMLParagraphElement>("status");
const backendStateText = mustGetElement<HTMLParagraphElement>("backend-state");
const RUNTIME_MESSAGE_TIMEOUT_MS = 3500;

let entriesCache: EntrySummary[] = [];

unlockBtn.addEventListener("click", () => {
    void unlock();
});

refreshBtn.addEventListener("click", () => {
    void loadEntries();
});

lockBtn.addEventListener("click", () => {
    void lockSession();
});

passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        void unlock();
    }
});

void runInitialCheck();

async function runInitialCheck(): Promise<void> {
    const isAvailable = await ensureBackendAvailable();
    if (!isAvailable) {
        console.warn("Healthcheck inicial falhou.");
        return;
    }

    try {
        const sessionStatus = await sendMessage<SessionStatusUiResult>({ type: "GET_SESSION_STATUS" });
        if (!sessionStatus.ok) {
            console.warn("GET_SESSION_STATUS retornou erro:", sessionStatus.error.code);
            setStatus("Backend online. Pronto para desbloquear.");
            return;
        }

        if (sessionStatus.data.unlocked) {
            setStatus("Sessao ativa restaurada.", "success");
            await loadEntries();
            return;
        }
    } catch (error) {
        console.warn("Falha ao consultar status da sessao na inicializacao:", error);
    }

    setStatus("Backend online. Pronto para desbloquear.");
}

async function unlock(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    const masterPassword = passwordInput.value;
    if (!masterPassword) {
        console.warn("Senha mestra nao informada.");
        setStatus("Informe a senha mestra.", "error");
        return;
    }

    setStatus("Desbloqueando sessao...");
    toggleLoading(true);

    const response = await sendMessage<UnlockUiResult>({
        type: "UNLOCK",
        masterPassword
    });

    toggleLoading(false);

    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    passwordInput.value = "";
    setStatus(`Sessao desbloqueada. TTL: ${response.data.ttlSecs}s`, "success");
    await loadEntries();
}

async function loadEntries(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    setStatus("Atualizando credenciais...");

    const response = await sendMessage<ListEntriesUiResult>({ type: "LIST_ENTRIES" });
    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        if (response.error.code === "SESSION_EXPIRED") {
            entriesCache = [];
            renderEntries();
        }
        return;
    }

    entriesCache = await prioritizeEntriesByActivePage(response.data.entries);
    renderEntries();

    if (entriesCache.length === 0) {
        setStatus("Nenhuma credencial encontrada.");
        return;
    }

    setStatus(`${entriesCache.length} credencial(is) carregada(s).`, "success");
}

function renderEntries(): void {
    entriesList.textContent = "";

    for (const entry of entriesCache) {
        const item = document.createElement("li");
        item.className = "entry-item";

        const title = document.createElement("div");
        title.className = "entry-title";
        title.textContent = `${entry.servico} - ${entry.usuario}`;

        const actions = document.createElement("div");
        actions.className = "entry-actions";

        const autofillButton = document.createElement("button");
        autofillButton.type = "button";
        autofillButton.className = "entry-action";
        autofillButton.textContent = "Autofill";
        autofillButton.addEventListener("click", () => {
            void useCredential(entry);
        });

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "entry-action secondary";
        copyButton.textContent = "Copiar senha";
        copyButton.addEventListener("click", () => {
            void copyPassword(entry);
        });

        const copyUserButton = document.createElement("button");
        copyUserButton.type = "button";
        copyUserButton.className = "entry-action secondary";
        copyUserButton.textContent = "Copiar usuario";
        copyUserButton.addEventListener("click", () => {
            void copyUsername(entry);
        });

        const meta = document.createElement("div");
        meta.className = "entry-meta";
        meta.textContent = entry.url ?? "Sem URL cadastrada";

        actions.append(autofillButton, copyButton, copyUserButton);
        item.append(title, actions, meta);
        entriesList.append(item);
    }
}

async function useCredential(entry: EntrySummary): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    setStatus(`Buscando senha para ${entry.servico}...`);

    let response: RuntimeResponse<GetPasswordUiResult>;
    try {
        response = await sendMessage<GetPasswordUiResult>({
            type: "GET_ENTRY_PASSWORD",
            entryId: entry.id,
            username: entry.usuario
        });
    } catch (error) {
        console.error("Falha ao buscar senha/autofill via background:", error);
        setStatus("Falha ao obter senha da API local. Tente novamente.", "error");
        return;
    }

    if (!response.ok) {
        console.warn("GET_ENTRY_PASSWORD retornou erro:", response.error.code);
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    if (response.data.filled) {
        setStatus("Autofill enviado para a aba ativa.", "success");
    } else {
        const reason = response.data.reason ?? "UNKNOWN";
        const reasonDetail = response.data.reasonDetail;
        console.warn(`Autofill nao executado. Motivo: ${describeAutofillReason(reason)} (${reason})`);
        if (reasonDetail) {
            console.warn("Detalhe tecnico do bloqueio:", reasonDetail);
        }
        setStatus(mapAutofillFailureMessage(reason), "error");
    }
}

async function copyPassword(entry: EntrySummary, silentOnSuccess = false): Promise<boolean> {
    if (!(await ensureBackendAvailable())) {
        return false;
    }

    if (!silentOnSuccess) {
        setStatus(`Obtendo senha de ${entry.servico} para copia...`);
    }

    let response: RuntimeResponse<GetPasswordValueUiResult>;
    try {
        response = await sendMessage<GetPasswordValueUiResult>({
            type: "GET_ENTRY_PASSWORD_VALUE",
            entryId: entry.id
        });
    } catch (error) {
        console.error("Falha ao obter senha para copia:", error);
        if (!silentOnSuccess) {
            setStatus("Falha ao obter senha para copia.", "error");
        }
        return false;
    }

    if (!response.ok) {
        if (!silentOnSuccess) {
            setStatus(mapFriendlyError(response.error.code), "error");
        }
        return false;
    }

    const copied = await writeToClipboard(response.data.password);
    if (!copied) {
        if (!silentOnSuccess) {
            setStatus("Nao foi possivel copiar a senha no clipboard deste navegador.", "error");
        }
        return false;
    }

    if (!silentOnSuccess) {
        setStatus("Senha copiada para clipboard.", "success");
    }

    return true;
}

async function copyUsername(entry: EntrySummary): Promise<boolean> {
    if (!entry.usuario) {
        setStatus("Usuario vazio nesta credencial.", "error");
        return false;
    }

    const copied = await writeToClipboard(entry.usuario);
    if (!copied) {
        setStatus("Nao foi possivel copiar o usuario no clipboard deste navegador.", "error");
        return false;
    }

    setStatus("Usuario copiado para clipboard.", "success");
    return true;
}

async function lockSession(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    const response = await sendMessage<{ locked: boolean }>({ type: "LOCK_SESSION" });
    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    entriesCache = [];
    renderEntries();
    setStatus("Sessao encerrada.", "success");
}

async function ensureBackendAvailable(options?: { showReadyStatus?: boolean }): Promise<boolean> {
    console.log("Verificando disponibilidade do backend...");
    try {
        const healthResponse = await sendMessage<{ status: string }>({ type: "HEALTH_CHECK" });
        if (!healthResponse.ok) {
            console.log("Backend indisponivel:", healthResponse.error);
            setInteractive(false);
            setBackendState("offline");
            setStatus("API local offline. Inicie o app principal para continuar.", "error");
            return false;
        }
    } catch (error) {
        console.error("Falha ao executar healthcheck:", error);
        setInteractive(false);
        setBackendState("offline");
        setStatus("API local offline. Inicie o app principal para continuar.", "error");
        return false;
    }
    console.log("Backend disponivel.");

    setInteractive(true);
    setBackendState("online");
    if (options?.showReadyStatus) {
        setStatus("Backend online. Pronto para desbloquear.");
    }

    return true;
}

function setBackendState(state: "online" | "offline"): void {
    if (state === "online") {
        backendStateText.textContent = "Status do backend: online";
        return;
    }

    backendStateText.textContent = "Status do backend: offline";
}

function setInteractive(enabled: boolean): void {
    unlockBtn.disabled = !enabled;
    refreshBtn.disabled = !enabled;
    lockBtn.disabled = !enabled;
    passwordInput.disabled = !enabled;
}

function toggleLoading(loading: boolean): void {
    unlockBtn.disabled = loading;
    refreshBtn.disabled = loading;
    lockBtn.disabled = loading;
}

function setStatus(message: string, tone: "error" | "success" | "neutral" = "neutral"): void {
    statusText.textContent = message;
    statusText.classList.remove("error", "success");
    if (tone !== "neutral") {
        statusText.classList.add(tone);
    }
}

function mapFriendlyError(code: string): string {
    if (code === "UNAUTHORIZED") {
        return "Senha mestra incorreta ou cofre invalido.";
    }
    if (code === "API_OFFLINE") {
        return "API local offline. Verifique se o app principal esta em execucao.";
    }
    if (code === "SESSION_EXPIRED") {
        return "Sessao expirada. Faca unlock novamente.";
    }
    if (code === "NOT_FOUND") {
        return "Credencial nao encontrada ou sessao nao existe mais.";
    }
    if (code === "BAD_REQUEST") {
        return "Dados invalidos enviados para a API local.";
    }
    if (code === "INVALID_RESPONSE") {
        return "Resposta invalida da API local.";
    }
    return "Falha inesperada na comunicacao com a API local.";
}

function describeAutofillReason(reason: string): string {
    if (reason === "PASSWORD_FIELD_NOT_FOUND") {
        return "campo de senha nao encontrado na pagina";
    }
    if (reason === "USERNAME_FIELD_NOT_FOUND") {
        return "campo de usuario nao encontrado para preencher junto com a senha";
    }
    if (reason === "NO_FILLABLE_FIELDS") {
        return "nenhum campo de login visivel/editavel foi detectado";
    }
    if (reason === "ACTIVE_TAB_NOT_FOUND") {
        return "nenhuma aba ativa disponivel";
    }
    if (reason === "CONTENT_SCRIPT_UNREACHABLE") {
        return "content script nao esta acessivel nesta pagina (ex.: chrome://, edge://, web store)";
    }
    if (reason === "CONTENT_SCRIPT_NO_RESPONSE") {
        return "content script nao respondeu ao comando de autofill";
    }

    return "motivo desconhecido";
}

function mapAutofillFailureMessage(reason: string): string {
    if (reason === "CONTENT_SCRIPT_UNREACHABLE") {
        return "Nao foi possivel preencher nesta pagina. O site pode bloquear scripts (CSP/CORS/iframe).";
    }
    if (reason === "PASSWORD_FIELD_NOT_FOUND") {
        return "Campo de senha nao encontrado nesta pagina.";
    }
    if (reason === "USERNAME_FIELD_NOT_FOUND") {
        return "Campo de usuario nao encontrado nesta pagina.";
    }
    if (reason === "NO_FILLABLE_FIELDS") {
        return "Nenhum campo de login preenchivel foi encontrado.";
    }

    return "Senha obtida, mas nao foi possivel preencher automaticamente nesta pagina.";
}

async function writeToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.warn("Falha ao escrever no clipboard:", error);
        return false;
    }
}

async function prioritizeEntriesByActivePage(entries: EntrySummary[]): Promise<EntrySummary[]> {
    const activeUrl = await getActiveTabUrl();
    if (!activeUrl) {
        return entries;
    }

    const sorted = [...entries].sort((a, b) => scoreEntryForUrl(b.url, activeUrl) - scoreEntryForUrl(a.url, activeUrl));
    return sorted;
}

async function getActiveTabUrl(): Promise<string | null> {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return activeTab?.url ?? null;
    } catch {
        return null;
    }
}

function scoreEntryForUrl(entryUrl: string | undefined, activeUrl: string): number {
    if (!entryUrl) {
        return 0;
    }

    try {
        const entry = new URL(entryUrl);
        const active = new URL(activeUrl);

        if (entry.origin === active.origin && entry.pathname === active.pathname) {
            return 30;
        }
        if (entry.hostname === active.hostname) {
            return 20;
        }
        if (active.hostname.endsWith(`.${entry.hostname}`) || entry.hostname.endsWith(`.${active.hostname}`)) {
            return 10;
        }
    } catch {
        return 0;
    }

    return 0;
}

async function sendMessage<T>(payload: RuntimeRequest): Promise<RuntimeResponse<T>> {
    console.log(`Enviando mensagem para background: ${payload.type}`);

    return new Promise<RuntimeResponse<T>>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Timeout aguardando resposta do background."));
        }, RUNTIME_MESSAGE_TIMEOUT_MS);

        chrome.runtime.sendMessage(payload, (response: RuntimeResponse<T> | undefined) => {
            clearTimeout(timeoutId);

            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (!response) {
                reject(new Error("Background nao retornou resposta."));
                return;
            }

            resolve(response);
        });
    });
}

function mustGetElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Elemento obrigatorio nao encontrado: ${id}`);
    }
    return element as T;
}
