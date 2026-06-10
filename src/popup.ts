import type { EntrySummary } from "./types/api.js";
import type {
    CreateVaultUiResult,
    CreateEntryUiResult,
    DeleteEntryUiResult,
    EditEntryUiResult,
    GetEntryNotesUiResult,
    GetPasswordValueUiResult,
    GetPasswordUiResult,
    ListEntriesUiResult,
    RuntimeRequest,
    RuntimeResponse,
    SessionStatusUiResult,
    UnlockUiResult,
    VaultStatusUiResult,
    ChangePasswordUiResult
} from "./types/messages.js";

const unlockBtn = mustGetElement<HTMLButtonElement>("unlock-btn");
const createVaultBtn = mustGetElement<HTMLButtonElement>("create-vault-btn");
const refreshBtn = mustGetElement<HTMLButtonElement>("refresh-btn");
const lockBtn = mustGetElement<HTMLButtonElement>("lock-btn");
const changePasswordBtn = mustGetElement<HTMLButtonElement>("change-password-btn");
const passwordInput = mustGetElement<HTMLInputElement>("master-password");
const unlockPanel = mustGetElement<HTMLElement>("unlock-panel");
const tabEntriesBtn = mustGetElement<HTMLButtonElement>("tab-entries-btn");
const tabCreateBtn = mustGetElement<HTMLButtonElement>("tab-create-btn");
const entriesPanel = mustGetElement<HTMLElement>("entries-panel");
const createPanel = mustGetElement<HTMLElement>("create-panel");
const createServiceInput = mustGetElement<HTMLInputElement>("create-service");
const createUsernameInput = mustGetElement<HTMLInputElement>("create-username");
const createPasswordInput = mustGetElement<HTMLInputElement>("create-password");
const createUrlInput = mustGetElement<HTMLInputElement>("create-url");
const createNotesInput = mustGetElement<HTMLTextAreaElement>("create-notes");
const createEntryBtn = mustGetElement<HTMLButtonElement>("create-entry-btn");
const clearCreateBtn = mustGetElement<HTMLButtonElement>("clear-create-btn");
const createPanelTitle = mustGetElement<HTMLHeadingElement>("create-panel-title");
const entriesList = mustGetElement<HTMLUListElement>("entries-list");
const statusText = mustGetElement<HTMLParagraphElement>("status");
const backendStateText = mustGetElement<HTMLParagraphElement>("backend-state");
const themeToggleBtn = mustGetElement<HTMLButtonElement>("theme-toggle-btn");
const notesInfoBtn = mustGetElement<HTMLButtonElement>("notes-info-btn");
const notesHelp = mustGetElement<HTMLElement>("notes-help");
const changePasswordModal = mustGetElement<HTMLDialogElement>("change-password-modal");
const changePasswordForm = mustGetElement<HTMLFormElement>("change-password-form");
const newPasswordInput = mustGetElement<HTMLInputElement>("new-password");
const confirmPasswordInput = mustGetElement<HTMLInputElement>("confirm-password");
const closeModalBtn = mustGetElement<HTMLButtonElement>("close-modal-btn");
const cancelPasswordBtn = mustGetElement<HTMLButtonElement>("cancel-password-btn");
const confirmPasswordBtn = mustGetElement<HTMLButtonElement>("confirm-password-btn");
const themeToggleIconLight = mustGetElement<SVGSVGElement>("theme-toggle-icon-light");
const themeToggleIconDark = mustGetElement<SVGSVGElement>("theme-toggle-icon-dark");
const settingsBtn = mustGetElement<HTMLButtonElement>("settings-btn");
const settingsModal = mustGetElement<HTMLDialogElement>("settings-modal");
const settingsForm = mustGetElement<HTMLFormElement>("settings-form");
const apiPortInput = mustGetElement<HTMLInputElement>("api-port-input");
const closeSettingsBtn = mustGetElement<HTMLButtonElement>("close-settings-btn");
const cancelSettingsBtn = mustGetElement<HTMLButtonElement>("cancel-settings-btn");
const openShortcutsBtn = mustGetElement<HTMLButtonElement>("open-shortcuts-btn");
const saveSettingsBtn = mustGetElement<HTMLButtonElement>("save-settings-btn");
const sessionStateText = mustGetElement<HTMLParagraphElement>("session-state");
const entriesSearchInput = mustGetElement<HTMLInputElement>("entries-search-input");
const entriesEmptyState = mustGetElement<HTMLElement>("entries-empty-state");
const entriesEmptyText = mustGetElement<HTMLParagraphElement>("entries-empty-text");
const emptyStateCreateBtn = mustGetElement<HTMLButtonElement>("empty-state-create-btn");
const toggleMasterPasswordBtn = mustGetElement<HTMLButtonElement>("toggle-master-password-btn");
const toggleCreatePasswordBtn = mustGetElement<HTMLButtonElement>("toggle-create-password-btn");
const createEntryForm = mustGetElement<HTMLFormElement>("create-entry-form");
const confirmDeleteModal = mustGetElement<HTMLDialogElement>("confirm-delete-modal");
const confirmDeleteText = mustGetElement<HTMLParagraphElement>("confirm-delete-text");
const closeDeleteBtn = mustGetElement<HTMLButtonElement>("close-delete-btn");
const cancelDeleteBtn = mustGetElement<HTMLButtonElement>("cancel-delete-btn");
const confirmDeleteBtn = mustGetElement<HTMLButtonElement>("confirm-delete-btn");
const RUNTIME_MESSAGE_TIMEOUT_MS = 3500;
const PAGE_METADATA_TIMEOUT_MS = 1500;
const THEME_STORAGE_KEY = "safeguard_theme";
const API_PORT_STORAGE_KEY = "safeguard_api_port";
const CLIPBOARD_CLEAR_DELAY_MS = 30_000;
const SESSION_TICKER_INTERVAL_MS = 10_000;

// Icones Phosphor (paths em viewBox 256) usados nos botoes de acao das credenciais.
const ICON_PATH_KEY =
    "M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A80,80,0,0,0,216.57,39.43ZM224,98.1c-1.09,34.09-29.75,61.86-63.89,61.9h-.14a63.7,63.7,0,0,1-23.65-4.51,8,8,0,0,0-8.84,1.68L116.69,168H96a8,8,0,0,0-8,8v16H72a8,8,0,0,0-8,8v16H40V187.31l58.83-58.82a8,8,0,0,0,1.68-8.84A63.72,63.72,0,0,1,96,96.14C96,62,123.78,33.36,157.88,32.29A64,64,0,0,1,224,98.1ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z";
const ICON_PATH_USER =
    "M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z";
const ICON_PATH_PENCIL =
    "M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z";
const ICON_PATH_TRASH =
    "M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z";

type ThemeMode = "dark" | "light";
type EntryFormMode = "create" | "edit";

interface EditingEntryState {
    entryId: string;
    servico: string;
    usuario: string;
    url: string;
    notas: string;
}

interface ActivePageMetadata {
    title: string | null;
    manifestHref: string | null;
}

interface ActivePageCredentialFields {
    usernameValue: string | null;
    passwordValue: string | null;
}

let entriesCache: EntrySummary[] = [];
let entriesFilter = "";
let sessionUnlocked = false;
let vaultExists = true;
let currentTheme: ThemeMode = "dark";
let entryFormMode: EntryFormMode = "create";
let editingEntryState: EditingEntryState | null = null;
let notesLoadSequence = 0;
let apiPort: number | null = null;
let pendingDeleteEntry: EntrySummary | null = null;
let sessionExpiresAtUnix: number | null = null;
let sessionMaxExpiresAtUnix: number | null = null;
let sessionTickerInterval: number | null = null;
let clipboardClearTimeout: number | null = null;

void initializeTheme();
void initializeSettings();
syncSessionUi();

unlockBtn.addEventListener("click", () => {
    void unlock();
});

createVaultBtn.addEventListener("click", () => {
    void createVault();
});

refreshBtn.addEventListener("click", () => {
    void loadEntries();
});

lockBtn.addEventListener("click", () => {
    void lockSession();
});

changePasswordBtn.addEventListener("click", () => {
    openChangePasswordModal();
});

closeModalBtn.addEventListener("click", () => {
    closeChangePasswordModal();
});

cancelPasswordBtn.addEventListener("click", () => {
    closeChangePasswordModal();
});

changePasswordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void changePassword();
});

themeToggleBtn.addEventListener("click", () => {
    void toggleTheme();
});

settingsBtn.addEventListener("click", () => {
    openSettingsModal();
});

closeSettingsBtn.addEventListener("click", () => {
    closeSettingsModal();
});

cancelSettingsBtn.addEventListener("click", () => {
    closeSettingsModal();
});

openShortcutsBtn.addEventListener("click", () => {
    void openBrowserShortcutsPage();
});

settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSettings();
});

closeDeleteBtn.addEventListener("click", () => {
    closeConfirmDeleteModal();
});

cancelDeleteBtn.addEventListener("click", () => {
    closeConfirmDeleteModal();
});

confirmDeleteBtn.addEventListener("click", () => {
    const entry = pendingDeleteEntry;
    closeConfirmDeleteModal();
    if (entry) {
        void performDeleteEntry(entry);
    }
});

// Cobre tambem o fechamento nativo do dialog (tecla Esc).
confirmDeleteModal.addEventListener("close", () => {
    pendingDeleteEntry = null;
});

emptyStateCreateBtn.addEventListener("click", () => {
    setActiveTab("create");
});

entriesSearchInput.addEventListener("input", () => {
    entriesFilter = entriesSearchInput.value.trim().toLowerCase();
    renderEntries();
});

bindPasswordToggle(toggleMasterPasswordBtn, passwordInput);
bindPasswordToggle(toggleCreatePasswordBtn, createPasswordInput);

notesInfoBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotesHelp();
});

document.addEventListener("click", (event) => {
    if (notesHelp.classList.contains("hidden")) {
        return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
        return;
    }

    if (notesHelp.contains(target) || notesInfoBtn.contains(target)) {
        return;
    }

    setNotesHelpVisible(false);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        setNotesHelpVisible(false);
    }
});

document.addEventListener("focusin", (event) => {
    if (notesHelp.classList.contains("hidden")) {
        return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
        return;
    }

    if (notesHelp.contains(target) || notesInfoBtn.contains(target)) {
        return;
    }

    setNotesHelpVisible(false);
});

tabEntriesBtn.addEventListener("click", () => {
    setActiveTab("entries");
});

tabCreateBtn.addEventListener("click", () => {
    setActiveTab("create");
});

clearCreateBtn.addEventListener("click", () => {
    if (entryFormMode === "edit") {
        clearCreateForm();
        resetEntryFormMode();
        setActiveTab("entries");
        setStatus("Edição de chave cancelada.", "neutral");
        return;
    }

    clearCreateForm();
});

createEntryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void createEntry();
});

createNotesInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void createEntry();
    }
});

passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        void unlock();
    }
});

void runInitialCheck();

async function initializeTheme(): Promise<void> {
    const storedTheme = await loadStoredTheme();
    applyTheme(storedTheme ?? "dark");
}

function resetEntryFormMode(): void {
    notesLoadSequence += 1;
    entryFormMode = "create";
    editingEntryState = null;
    createPanelTitle.textContent = "Cadastrar chave";
    createEntryBtn.textContent = "Salvar chave";
    clearCreateBtn.textContent = "Limpar";
}

function updateEntryFormMode(mode: EntryFormMode): void {
    entryFormMode = mode;
    if (mode === "create") {
        resetEntryFormMode();
        return;
    }

    createPanelTitle.textContent = "Editar chave";
    createEntryBtn.textContent = "Salvar alterações";
    clearCreateBtn.textContent = "Cancelar edição";
}

async function loadStoredTheme(): Promise<ThemeMode | null> {
    try {
        const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
        const value = result[THEME_STORAGE_KEY] as unknown;
        if (value === "dark" || value === "light") {
            return value;
        }
    } catch (error) {
        console.warn("Falha ao carregar tema salvo:", error);
    }

    return null;
}

async function persistTheme(theme: ThemeMode): Promise<void> {
    try {
        await chrome.storage.local.set({
            [THEME_STORAGE_KEY]: theme
        });
    } catch (error) {
        console.warn("Falha ao salvar tema:", error);
    }
}

function applyTheme(theme: ThemeMode): void {
    currentTheme = theme;
    document.documentElement.dataset.theme = theme;
    syncThemeToggleUi();
}

function syncThemeToggleUi(): void {
    const isLight = currentTheme === "light";
    themeToggleIconLight.classList.toggle("hidden", isLight);
    themeToggleIconDark.classList.toggle("hidden", !isLight);
    themeToggleBtn.setAttribute("aria-pressed", String(isLight));
    const label = isLight ? "Alternar para tema escuro" : "Alternar para tema claro";
    themeToggleBtn.setAttribute("aria-label", label);
    themeToggleBtn.setAttribute("data-balloon", label);
    themeToggleBtn.setAttribute("data-balloon-pos", "down-right");
}

async function initializeSettings(): Promise<void> {
    const stored = await loadStoredApiPort();
    apiPort = stored;
}

async function loadStoredApiPort(): Promise<number | null> {
    try {
        const result = await chrome.storage.local.get(API_PORT_STORAGE_KEY);
        const value = result[API_PORT_STORAGE_KEY] as unknown;
        if (typeof value === "number") {
            return value;
        }
        if (typeof value === "string" && value !== "") {
            const parsed = parseInt(value, 10);
            if (!Number.isNaN(parsed)) return parsed;
        }
    } catch (error) {
        console.warn("Falha ao carregar porta da API salva:", error);
    }
    return null;
}

async function persistApiPort(port: number | null): Promise<void> {
    try {
        await chrome.storage.local.set({ [API_PORT_STORAGE_KEY]: port });
    } catch (error) {
        console.warn("Falha ao salvar porta da API:", error);
    }
}

function openSettingsModal(): void {
    apiPortInput.value = apiPort !== null ? String(apiPort) : "";
    settingsModal.showModal();
}

function closeSettingsModal(): void {
    settingsModal.close();
}

async function openBrowserShortcutsPage(): Promise<void> {
    closeSettingsModal();

    const shortcutsUrl = navigator.userAgent.includes("Edg/")
        ? "edge://extensions/shortcuts"
        : "chrome://extensions/shortcuts";

    try {
        await chrome.tabs.create({ url: shortcutsUrl });
    } catch (error) {
        console.warn("Falha ao abrir a tela de atalhos do navegador:", error);
        setStatus("Não foi possível abrir a tela de atalhos agora.", "error");
    }
}

async function saveSettings(): Promise<void> {
    const raw = apiPortInput.value.trim();

    if (raw !== "") {
        const parsed = parseInt(raw, 10);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
            setStatus("Porta inválida. Informe um número entre 1 e 65535.", "error");
            return;
        }
        apiPort = parsed;
    } else {
        apiPort = null;
    }

    // O background escuta a mudanca no storage e recria o client da API
    // automaticamente — nao e necessario recarregar a extensao.
    await persistApiPort(apiPort);
    closeSettingsModal();
    setStatus(
        apiPort !== null
            ? `Porta da API salva: ${apiPort}.`
            : "Porta personalizada removida. Usando a porta padrão (5474).",
        "success"
    );

    // Aguarda o background recriar o client antes de revalidar a conexao.
    window.setTimeout(() => {
        void ensureBackendAvailable();
    }, 300);
}

function bindPasswordToggle(button: HTMLButtonElement, input: HTMLInputElement): void {
    button.addEventListener("click", () => {
        setPasswordVisibility(button, input, input.type === "password");
        input.focus();
    });
}

function setPasswordVisibility(button: HTMLButtonElement, input: HTMLInputElement, visible: boolean): void {
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
    button.querySelector(".icon-eye")?.classList.toggle("hidden", visible);
    button.querySelector(".icon-eye-slash")?.classList.toggle("hidden", !visible);
}

async function toggleTheme(): Promise<void> {
    const nextTheme: ThemeMode = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    await persistTheme(nextTheme);
}

function toggleNotesHelp(): void {
    setNotesHelpVisible(notesHelp.classList.contains("hidden"));
}

function setNotesHelpVisible(visible: boolean): void {
    notesHelp.classList.toggle("hidden", !visible);
    notesInfoBtn.setAttribute("aria-expanded", String(visible));
}

async function runInitialCheck(): Promise<void> {
    console.info("[cofre-popup] runInitialCheck: iniciando verificacao do backend e da sessao.");
    setActiveTab("entries");
    const isAvailable = await ensureBackendAvailable();
    if (!isAvailable) {
        console.warn("Healthcheck inicial falhou.");
        return;
    }

    try {
        console.info("[cofre-popup] runInitialCheck: consultando GET_VAULT_STATUS.");
        const vaultStatus = await sendMessage<VaultStatusUiResult>({ type: "GET_VAULT_STATUS" });
        if (!vaultStatus.ok) {
            console.warn("[cofre-popup] runInitialCheck: GET_VAULT_STATUS retornou erro.", vaultStatus.error);
            setStatus(
                "Não foi possível validar o status do cofre agora. Tentando restaurar a sessão local...",
                "error"
            );
        } else {
            vaultExists = vaultStatus.data.exists;
            console.info("[cofre-popup] runInitialCheck: status do cofre recebido.", {
                exists: vaultExists
            });
            syncVaultUi();

            if (!vaultExists) {
                sessionUnlocked = false;
                syncSessionUi();
                setStatus("Nenhum cofre encontrado. Informe a senha mestra e clique em Cadastrar cofre.");
                return;
            }
        }
    } catch (error) {
        console.warn("Falha ao consultar status do cofre na inicializacao:", error);
        setStatus("Não foi possível verificar se o cofre existe. Tentando restaurar a sessão local...", "error");
    }

    try {
        console.info("[cofre-popup] runInitialCheck: consultando GET_SESSION_STATUS.");
        const sessionStatus = await sendMessage<SessionStatusUiResult>({ type: "GET_SESSION_STATUS" });
        if (!sessionStatus.ok) {
            console.warn("GET_SESSION_STATUS retornou erro:", sessionStatus.error.code);
            setStatus("Backend online. Pronto para desbloquear.", "success");
            return;
        }

        console.info("[cofre-popup] runInitialCheck: resposta de GET_SESSION_STATUS.", sessionStatus.data);

        if (sessionStatus.data.unlocked) {
            sessionUnlocked = true;
            applySessionWindow(sessionStatus.data);
            syncSessionUi();
            setStatus(`Sessão ativa restaurada. ${formatSessionWindow(sessionStatus.data)}`, "success");
            await loadEntries();
            return;
        }

        sessionUnlocked = false;
        syncSessionUi();
    } catch (error) {
        console.warn("Falha ao consultar status da sessao na inicializacao:", error);
    }

    setStatus("Backend online. Pronto para desbloquear.", "success");
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

    if (!vaultExists) {
        setStatus("Cofre não encontrado. Clique em Cadastrar cofre para criar o primeiro cofre.", "error");
        return;
    }

    setStatus("Desbloqueando sessão...");
    setButtonLoading(unlockBtn, true);

    let response: RuntimeResponse<UnlockUiResult>;
    try {
        response = await sendMessage<UnlockUiResult>({
            type: "UNLOCK",
            masterPassword
        });
    } catch (error) {
        console.error("Falha ao desbloquear via background:", error);
        setStatus("Sem resposta do background da extensão. Tente novamente.", "error");
        return;
    } finally {
        setButtonLoading(unlockBtn, false);
    }

    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    passwordInput.value = "";
    setPasswordVisibility(toggleMasterPasswordBtn, passwordInput, false);
    setStatus(`Sessão desbloqueada. ${formatSessionWindow(response.data)}`, "success");
    sessionUnlocked = true;
    applySessionWindow(response.data);
    syncSessionUi();
    setInteractive(true);
    await loadEntries();
}

async function createVault(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    const masterPassword = passwordInput.value;
    if (!masterPassword) {
        setStatus("Informe a senha mestra para cadastrar o cofre.", "error");
        return;
    }

    setStatus("Cadastrando cofre...");
    setButtonLoading(createVaultBtn, true);

    let response: RuntimeResponse<CreateVaultUiResult>;
    try {
        response = await sendMessage<CreateVaultUiResult>({
            type: "CREATE_VAULT",
            masterPassword
        });
    } catch (error) {
        console.error("Falha ao cadastrar cofre via background:", error);
        setStatus("Sem resposta do background da extensão. Tente novamente.", "error");
        return;
    } finally {
        setButtonLoading(createVaultBtn, false);
    }

    if (!response.ok) {
        if (response.error.code === "CONFLICT") {
            vaultExists = true;
            syncVaultUi();
            setStatus("Cofre já existe. Use Desbloquear para iniciar a sessão.", "error");
            return;
        }

        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    passwordInput.value = "";
    setPasswordVisibility(toggleMasterPasswordBtn, passwordInput, false);
    vaultExists = true;
    sessionUnlocked = true;
    applySessionWindow(response.data);
    syncVaultUi();
    syncSessionUi();
    setInteractive(true);
    setStatus(`Cofre cadastrado e sessão desbloqueada. ${formatSessionWindow(response.data)}`, "success");
    await loadEntries();
}

async function loadEntries(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    console.info("[cofre-popup] loadEntries: solicitando LIST_ENTRIES.");
    setStatus("Atualizando credenciais...");
    setButtonLoading(refreshBtn, true);

    let response: RuntimeResponse<ListEntriesUiResult>;
    try {
        response = await sendMessage<ListEntriesUiResult>({ type: "LIST_ENTRIES" });
    } catch (error) {
        console.error("[cofre-popup] loadEntries: falha na comunicacao com o background.", error);
        setStatus("Sem resposta do background da extensão. Tente novamente.", "error");
        return;
    } finally {
        setButtonLoading(refreshBtn, false);
    }

    if (!response.ok) {
        console.warn("[cofre-popup] loadEntries: LIST_ENTRIES retornou erro.", response.error);
        setStatus(mapFriendlyError(response.error.code), "error");
        if (response.error.code === "SESSION_EXPIRED" || response.error.code === "NOT_FOUND") {
            console.warn("[cofre-popup] loadEntries: tratando erro como sessao invalida/expirada.");
            entriesCache = [];
            sessionUnlocked = false;
            clearSessionWindow();
            resetEntryFormMode();
            vaultExists = true;
            syncVaultUi();
            syncSessionUi();
            setInteractive(true);
            setStatus(
                response.error.code === "NOT_FOUND"
                    ? "Sessão inválida ou expirada. Faça unlock novamente."
                    : "Sessão expirada. Faça unlock novamente.",
                "error"
            );
            renderEntries();
        }
        return;
    }

    entriesCache = await prioritizeEntriesByActivePage(response.data.entries);
    console.info("[cofre-popup] loadEntries: entradas carregadas.", {
        count: entriesCache.length
    });
    renderEntries();
    setStatus(formatEntriesCount(entriesCache.length));
}

async function createEntry(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    const servico = createServiceInput.value.trim();
    const usuario = createUsernameInput.value.trim();
    const senha = createPasswordInput.value;
    const url = createUrlInput.value.trim();
    const notas = createNotesInput.value.trim();

    if (entryFormMode === "create") {
        if (!servico || !usuario || !senha) {
            setStatus("Serviço, usuário e senha são obrigatórios.", "error");
            return;
        }

        setStatus("Salvando chave...");
        setButtonLoading(createEntryBtn, true);

        let response: RuntimeResponse<CreateEntryUiResult>;
        try {
            response = await sendMessage<CreateEntryUiResult>({
                type: "CREATE_ENTRY",
                service: servico,
                username: usuario,
                password: senha,
                url: url || undefined,
                notes: notas || undefined
            });
        } catch (error) {
            console.error("Falha ao cadastrar chave via background:", error);
            setStatus("Falha ao cadastrar a chave.", "error");
            return;
        } finally {
            setButtonLoading(createEntryBtn, false);
        }

        if (!response.ok) {
            setStatus(mapFriendlyError(response.error.code), "error");
            return;
        }

        clearCreateForm();
        resetEntryFormMode();
        setStatus(response.data.created ? "Chave cadastrada com sucesso." : "Chave atualizada com sucesso.", "success");
        setActiveTab("entries");
        await loadEntries();
        return;
    }

    if (!editingEntryState) {
        setStatus("Selecione uma chave para editar.", "error");
        return;
    }

    const updatePayload: {
        entryId: string;
        service?: string;
        username?: string;
        password?: string;
        url?: string;
        notes?: string;
    } = {
        entryId: editingEntryState.entryId
    };

    if (servico && servico !== editingEntryState.servico) {
        updatePayload.service = servico;
    }

    if (usuario && usuario !== editingEntryState.usuario) {
        updatePayload.username = usuario;
    }

    if (senha) {
        updatePayload.password = senha;
    }

    if (url !== editingEntryState.url) {
        updatePayload.url = url;
    }

    if (notas !== editingEntryState.notas) {
        updatePayload.notes = notas;
    }

    if (
        updatePayload.service === undefined &&
        updatePayload.username === undefined &&
        updatePayload.password === undefined &&
        updatePayload.url === undefined &&
        updatePayload.notes === undefined
    ) {
        setStatus("Nenhuma alteração detectada para salvar.", "error");
        return;
    }

    setStatus("Salvando alterações...");
    setButtonLoading(createEntryBtn, true);

    let response: RuntimeResponse<EditEntryUiResult>;
    try {
        response = await sendMessage<EditEntryUiResult>({
            type: "EDIT_ENTRY",
            ...updatePayload
        });
    } catch (error) {
        console.error("Falha ao editar chave via background:", error);
        setStatus("Falha ao editar a chave.", "error");
        return;
    } finally {
        setButtonLoading(createEntryBtn, false);
    }

    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    clearCreateForm();
    resetEntryFormMode();
    editingEntryState = null;
    setStatus(response.data.created ? "Chave cadastrada com sucesso." : "Chave atualizada com sucesso.", "success");
    setActiveTab("entries");
    await loadEntries();
}

function getFilteredEntries(): EntrySummary[] {
    if (!entriesFilter) {
        return entriesCache;
    }

    return entriesCache.filter((entry) => {
        const haystack = `${entry.servico} ${entry.usuario} ${entry.url ?? ""}`.toLowerCase();
        return haystack.includes(entriesFilter);
    });
}

function renderEntries(): void {
    entriesList.textContent = "";

    const visibleEntries = getFilteredEntries();

    entriesSearchInput.classList.toggle("hidden", entriesCache.length === 0);

    if (visibleEntries.length === 0) {
        const isFilterMiss = entriesCache.length > 0;
        entriesEmptyText.textContent = isFilterMiss
            ? "Nenhuma credencial corresponde à busca."
            : "Nenhuma credencial cadastrada.";
        emptyStateCreateBtn.classList.toggle("hidden", isFilterMiss);
        entriesEmptyState.classList.remove("hidden");
        return;
    }

    entriesEmptyState.classList.add("hidden");

    for (const entry of visibleEntries) {
        const item = document.createElement("li");
        item.className = "entry-item";

        const titleDiv = document.createElement("div");
        titleDiv.className = "entry-title";

        const title = document.createElement("div");
        title.className = "entry-title-text";
        title.textContent = `${entry.servico} - ${entry.usuario}`;
        title.title = `${entry.servico} - ${entry.usuario}`;

        const meta = document.createElement("a");
        meta.className = "entry-meta";
        meta.textContent = entry.url ?? "Sem URL cadastrada";
        if (entry.url) {
            meta.setAttribute("href", entry.url);
            meta.setAttribute("target", "_blank");
            meta.title = entry.url;
        }

        const actions = document.createElement("div");
        actions.className = "entry-actions";

        const autofillButton = document.createElement("button");
        autofillButton.type = "button";
        autofillButton.className = "entry-action autofill-action";
        autofillButton.textContent = "Autofill";
        autofillButton.addEventListener("click", () => {
            void useCredential(entry);
        });

        const copyButton = createIconActionButton("Copiar senha", "secondary", ICON_PATH_KEY, () => {
            void copyPassword(entry);
        });
        const copyUserButton = createIconActionButton("Copiar usuário", "secondary", ICON_PATH_USER, () => {
            void copyUsername(entry);
        });
        const editButton = createIconActionButton("Editar", "secondary", ICON_PATH_PENCIL, () => {
            void startEditEntry(entry);
        });
        const deleteButton = createIconActionButton("Excluir", "danger", ICON_PATH_TRASH, () => {
            openConfirmDeleteModal(entry);
        });

        titleDiv.append(title, meta);
        actions.append(autofillButton, copyButton, copyUserButton, editButton, deleteButton);
        item.append(titleDiv, actions);
        entriesList.append(item);
    }
}

function createIconActionButton(
    label: string,
    extraClass: string,
    iconPath: string,
    onClick: () => void
): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `entry-action icon-action ${extraClass}`;
    button.setAttribute("aria-label", label);
    button.setAttribute("data-balloon", label);
    // "up-right" alinha o tooltip a borda direita do botao (cresce para a esquerda);
    // centralizado ("up") ele ultrapassa a borda do card e gera scroll horizontal.
    button.setAttribute("data-balloon-pos", "up-right");
    button.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" aria-hidden="true" focusable="false">` +
        `<path fill="currentColor" d="${iconPath}"></path></svg>`;
    button.addEventListener("click", onClick);
    return button;
}

function openConfirmDeleteModal(entry: EntrySummary): void {
    pendingDeleteEntry = entry;
    confirmDeleteText.textContent = `Excluir a chave ${entry.servico} - ${entry.usuario}? Esta ação não pode ser desfeita.`;
    confirmDeleteModal.showModal();
}

function closeConfirmDeleteModal(): void {
    pendingDeleteEntry = null;
    confirmDeleteModal.close();
}

async function performDeleteEntry(entry: EntrySummary): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    setStatus(`Excluindo chave ${entry.servico}...`);

    let response: RuntimeResponse<DeleteEntryUiResult>;
    try {
        response = await sendMessage<DeleteEntryUiResult>({
            type: "DELETE_ENTRY",
            entryId: entry.id
        });
    } catch (error) {
        console.error("Falha ao excluir chave via background:", error);
        setStatus("Falha ao excluir a chave.", "error");
        return;
    }

    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    if (editingEntryState?.entryId === entry.id) {
        clearCreateForm();
        resetEntryFormMode();
    }

    entriesCache = entriesCache.filter((item) => item.id !== entry.id);
    renderEntries();
    setStatus(
        entriesCache.length === 0 ? "Chave excluída. Nenhuma credencial restante." : "Chave excluída com sucesso.",
        "success"
    );
}

async function startEditEntry(entry: EntrySummary): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    editingEntryState = {
        entryId: entry.id,
        servico: entry.servico,
        usuario: entry.usuario,
        url: entry.url ?? "",
        notas: ""
    };

    updateEntryFormMode("edit");
    createServiceInput.value = entry.servico;
    createUsernameInput.value = entry.usuario;
    createPasswordInput.value = "";
    createUrlInput.value = entry.url ?? "";
    createNotesInput.value = "";
    setActiveTab("create");
    setStatus(`Editando chave ${entry.servico}. Carregando notas...`);

    const sequence = ++notesLoadSequence;
    try {
        const response = await sendMessage<GetEntryNotesUiResult>({
            type: "GET_ENTRY_NOTES",
            entryId: entry.id
        });

        if (sequence !== notesLoadSequence) {
            return;
        }

        if (!response.ok) {
            console.warn("GET_ENTRY_NOTES retornou erro:", response.error.code);
            setStatus("Editando chave. Não foi possível carregar as notas agora.", "error");
            return;
        }

        const notes = response.data.notes ?? "";
        editingEntryState.notas = notes;
        createNotesInput.value = notes;
        setStatus("Chave carregada para edição.", "success");
    } catch (error) {
        console.warn("Falha ao carregar notas para edicao:", error);
        setStatus("Editando chave. Não foi possível carregar as notas agora.", "error");
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
        // Preenchimento parcial: um dos campos nao foi encontrado na pagina.
        if (response.data.reason === "USERNAME_FIELD_NOT_FOUND") {
            setStatus("Autofill parcial: senha preenchida, mas o campo de usuário não foi encontrado.", "error");
            return;
        }
        if (response.data.reason === "PASSWORD_FIELD_NOT_FOUND") {
            setStatus("Autofill parcial: usuário preenchido, mas o campo de senha não foi encontrado.", "error");
            return;
        }

        if (response.data.postActionAttempted && response.data.postActionExecuted) {
            setStatus("Autofill enviado e ações automáticas executadas.", "success");
            return;
        }

        if (response.data.postActionReason === "PARSE_INVALID") {
            setStatus("Autofill enviado. A ação das notas foi ignorada por formato inválido.");
            return;
        }

        if (response.data.postActionAttempted && !response.data.postActionExecuted) {
            const actionReason = describePostActionReason(response.data.postActionReason ?? "CLICK_ERROR");
            setStatus(`Autofill enviado. Aviso: ${actionReason}`);
            return;
        }

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
        setStatus(`Obtendo senha de ${entry.servico} para cópia...`);
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
            setStatus("Falha ao obter senha para cópia.", "error");
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
            setStatus("Não foi possível copiar a senha no clipboard deste navegador.", "error");
        }
        return false;
    }

    scheduleClipboardClear(response.data.password);

    if (!silentOnSuccess) {
        setStatus("Senha copiada. O clipboard será limpo em 30s (com o popup aberto).", "success");
    }

    return true;
}

function scheduleClipboardClear(copiedValue: string): void {
    if (clipboardClearTimeout !== null) {
        clearTimeout(clipboardClearTimeout);
    }

    clipboardClearTimeout = window.setTimeout(() => {
        clipboardClearTimeout = null;
        void clearClipboardIfUnchanged(copiedValue);
    }, CLIPBOARD_CLEAR_DELAY_MS);
}

async function clearClipboardIfUnchanged(copiedValue: string): Promise<void> {
    try {
        const current = await navigator.clipboard.readText();
        if (current !== copiedValue) {
            return;
        }

        await navigator.clipboard.writeText("");
        setStatus("Clipboard limpo por segurança.");
    } catch (error) {
        // Sem foco no popup o navegador bloqueia o acesso ao clipboard; nada a fazer.
        console.warn("Falha ao limpar clipboard automaticamente:", error);
    }
}

async function copyUsername(entry: EntrySummary): Promise<boolean> {
    if (!entry.usuario) {
        setStatus("Usuário vazio nesta credencial.", "error");
        return false;
    }

    const copied = await writeToClipboard(entry.usuario);
    if (!copied) {
        setStatus("Não foi possível copiar o usuário no clipboard deste navegador.", "error");
        return false;
    }

    setStatus("Usuário copiado para clipboard.", "success");
    return true;
}

function setActiveTab(tab: "entries" | "create"): void {
    const entriesActive = tab === "entries";
    tabEntriesBtn.classList.toggle("active", entriesActive);
    tabCreateBtn.classList.toggle("active", !entriesActive);
    tabEntriesBtn.setAttribute("aria-selected", String(entriesActive));
    tabCreateBtn.setAttribute("aria-selected", String(!entriesActive));

    if (!sessionUnlocked) {
        entriesPanel.classList.add("hidden");
        createPanel.classList.add("hidden");
        return;
    }

    entriesPanel.classList.toggle("hidden", !entriesActive);
    createPanel.classList.toggle("hidden", entriesActive);
    if (tab === "entries") {
        setStatus(formatEntriesCount(entriesCache.length));
        if (entriesCache.length > 0) {
            entriesSearchInput.focus();
        }
    } else {
        setStatus("Preencha os campos para cadastrar uma nova chave.");
        void prefillCreateFieldsFromActiveTab();
    }
}

function formatEntriesCount(count: number): string {
    if (count === 0) {
        return "Nenhuma credencial encontrada.";
    }

    return count === 1 ? "1 credencial carregada." : `${count} credenciais carregadas.`;
}

function clearCreateForm(): void {
    createServiceInput.value = "";
    createUsernameInput.value = "";
    createPasswordInput.value = "";
    createUrlInput.value = "";
    createNotesInput.value = "";
    setPasswordVisibility(toggleCreatePasswordBtn, createPasswordInput, false);
}

async function prefillCreateFieldsFromActiveTab(): Promise<void> {
    if (entryFormMode !== "create") {
        return;
    }

    const activeTab = await getActiveTabInfo();
    const activeUrl = activeTab?.url ?? null;
    if (!activeTab?.id || !normalizeCredentialUrl(activeUrl)) {
        return;
    }

    const [credentialUrl, serviceName, credentialFields] = await Promise.all([
        Promise.resolve(normalizeCredentialUrl(activeUrl)),
        getServiceNameFromActivePage(activeTab.id, activeUrl),
        readActivePageCredentialFields(activeTab.id)
    ]);

    if (entryFormMode !== "create") {
        return;
    }

    if (credentialUrl && !createUrlInput.value.trim()) {
        createUrlInput.value = credentialUrl;
    }

    if (serviceName && !createServiceInput.value.trim()) {
        createServiceInput.value = serviceName;
    }

    if (credentialFields?.usernameValue && !createUsernameInput.value.trim()) {
        createUsernameInput.value = credentialFields.usernameValue;
    }

    if (credentialFields?.passwordValue && !createPasswordInput.value) {
        createPasswordInput.value = credentialFields.passwordValue;
    }
}

function normalizeCredentialUrl(rawUrl: string | null): string | null {
    if (!rawUrl) {
        return null;
    }

    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }

        return url.origin;
    } catch {
        return null;
    }
}

async function getServiceNameFromActivePage(tabId: number, activeUrl: string | null): Promise<string | null> {
    const metadata = await readActivePageMetadata(tabId);
    const manifestName = await getManifestServiceName(metadata?.manifestHref ?? null);
    if (manifestName) {
        return manifestName;
    }

    const title = normalizeServiceName(metadata?.title ?? null);
    if (title) {
        return title;
    }

    return getHostnameServiceName(activeUrl);
}

async function readActivePageMetadata(tabId: number): Promise<ActivePageMetadata | null> {
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const manifestLink = document.querySelector<HTMLLinkElement>('link[rel~="manifest"]');
                const manifestHref = manifestLink?.href ? new URL(manifestLink.href, document.baseURI).href : null;

                return {
                    title: document.title || null,
                    manifestHref
                };
            }
        });

        return (result?.result ?? null) as ActivePageMetadata | null;
    } catch (error) {
        console.warn("Falha ao ler metadados da aba ativa:", error);
        return null;
    }
}

async function readActivePageCredentialFields(tabId: number): Promise<ActivePageCredentialFields | null> {
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                function isReadableInput(input: HTMLInputElement): boolean {
                    if (input.disabled || input.readOnly || input.type === "hidden") {
                        return false;
                    }

                    const style = window.getComputedStyle(input);
                    if (style.display === "none" || style.visibility === "hidden") {
                        return false;
                    }

                    return input.getClientRects().length > 0;
                }

                function normalizeFieldValue(value: string): string | null {
                    const normalized = value.replace(/\s+/g, " ").trim();
                    return normalized || null;
                }

                function scoreUsernameField(input: HTMLInputElement): number {
                    const text = [
                        input.name,
                        input.id,
                        input.autocomplete,
                        input.placeholder,
                        input.getAttribute("aria-label")
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    let score = 0;
                    if (text.includes("user")) score += 3;
                    if (text.includes("mail")) score += 2;
                    if (text.includes("login")) score += 2;
                    if (text.includes("nome")) score += 1;
                    return score;
                }

                const usernameCandidates = Array.from(
                    document.querySelectorAll<HTMLInputElement>(
                        "input[type='text'], input[type='email'], input:not([type]), input[name='user']"
                    )
                )
                    .filter((input) => isReadableInput(input) && normalizeFieldValue(input.value) !== null)
                    .sort((a, b) => scoreUsernameField(b) - scoreUsernameField(a));

                const passwordCandidate = Array.from(
                    document.querySelectorAll<HTMLInputElement>("input[type='password']")
                ).find((input) => isReadableInput(input) && input.value.length > 0);

                return {
                    usernameValue: normalizeFieldValue(usernameCandidates[0]?.value ?? ""),
                    passwordValue: passwordCandidate?.value || null
                };
            }
        });

        return (result?.result ?? null) as ActivePageCredentialFields | null;
    } catch (error) {
        console.warn("Falha ao ler campos de credencial da aba ativa:", error);
        return null;
    }
}

async function getManifestServiceName(manifestHref: string | null): Promise<string | null> {
    if (!manifestHref) {
        return null;
    }

    try {
        const response = await fetchWithTimeout(manifestHref, PAGE_METADATA_TIMEOUT_MS);
        if (!response.ok) {
            return null;
        }

        const manifest = (await response.json()) as { short_name?: unknown; name?: unknown };
        return normalizeServiceName(manifest.short_name) ?? normalizeServiceName(manifest.name);
    } catch (error) {
        console.warn("Falha ao carregar manifest da aba ativa:", error);
        return null;
    }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            credentials: "omit",
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function normalizeServiceName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized || null;
}

function getHostnameServiceName(rawUrl: string | null): string | null {
    if (!rawUrl) {
        return null;
    }

    try {
        const url = new URL(rawUrl);
        const hostname = url.hostname.replace(/^www\./i, "");
        const [label] = hostname.split(".");
        return normalizeServiceName(label);
    } catch {
        return null;
    }
}

async function lockSession(): Promise<void> {
    setButtonLoading(lockBtn, true);

    let response: RuntimeResponse<{ locked: boolean }>;
    try {
        response = await sendMessage<{ locked: boolean }>({ type: "LOCK_SESSION" });
    } catch (error) {
        console.error("Falha ao encerrar sessao via background:", error);
        setStatus("Sem resposta do background da extensão. Tente novamente.", "error");
        return;
    } finally {
        setButtonLoading(lockBtn, false);
    }

    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    entriesCache = [];
    entriesFilter = "";
    entriesSearchInput.value = "";
    renderEntries();
    sessionUnlocked = false;
    clearSessionWindow();
    resetEntryFormMode();
    syncSessionUi();
    setInteractive(true);
    setStatus("Sessão encerrada.", "success");
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
        setStatus("Backend online. Pronto para desbloquear.", "success");
    }

    return true;
}

function setBackendState(state: "online" | "offline"): void {
    if (state === "online") {
        backendStateText.textContent = "Status: online";
        return;
    }

    backendStateText.textContent = "Status: offline";
}

function setInteractive(enabled: boolean): void {
    unlockBtn.disabled = !enabled || !vaultExists;
    createVaultBtn.disabled = !enabled || sessionUnlocked;
    passwordInput.disabled = !enabled;
    tabEntriesBtn.disabled = !enabled || !sessionUnlocked;
    tabCreateBtn.disabled = !enabled || !sessionUnlocked;
    refreshBtn.disabled = !enabled || !sessionUnlocked;
    lockBtn.disabled = !enabled || !sessionUnlocked;
    createServiceInput.disabled = !enabled || !sessionUnlocked;
    createUsernameInput.disabled = !enabled || !sessionUnlocked;
    createPasswordInput.disabled = !enabled || !sessionUnlocked;
    createUrlInput.disabled = !enabled || !sessionUnlocked;
    createNotesInput.disabled = !enabled || !sessionUnlocked;
    createEntryBtn.disabled = !enabled || !sessionUnlocked;
    clearCreateBtn.disabled = !enabled || !sessionUnlocked;
}

function syncVaultUi(): void {
    createVaultBtn.classList.toggle("hidden", vaultExists);
    createVaultBtn.textContent = "Cadastrar cofre";
}

function syncSessionUi(): void {
    unlockPanel.classList.toggle("hidden", sessionUnlocked);
    lockBtn.classList.toggle("hidden", !sessionUnlocked);
    updateSessionIndicator();

    if (!sessionUnlocked) {
        stopSessionTicker();
        entriesPanel.classList.add("hidden");
        createPanel.classList.add("hidden");
        setPasswordVisibility(toggleMasterPasswordBtn, passwordInput, false);
        passwordInput.focus();
        return;
    }

    setActiveTab(tabCreateBtn.classList.contains("active") ? "create" : "entries");
}

function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
    button.classList.toggle("loading", loading);
    button.disabled = loading;
}

function applySessionWindow(session: { expiresAtUnix?: number; maxExpiresAtUnix?: number }): void {
    sessionExpiresAtUnix = typeof session.expiresAtUnix === "number" ? session.expiresAtUnix : null;
    sessionMaxExpiresAtUnix = typeof session.maxExpiresAtUnix === "number" ? session.maxExpiresAtUnix : null;
    updateSessionIndicator();
    startSessionTicker();
}

function clearSessionWindow(): void {
    sessionExpiresAtUnix = null;
    sessionMaxExpiresAtUnix = null;
    stopSessionTicker();
    updateSessionIndicator();
}

function computeSessionRemainingSecs(): number | null {
    if (sessionExpiresAtUnix === null) {
        return null;
    }

    const limit = sessionMaxExpiresAtUnix !== null
        ? Math.min(sessionExpiresAtUnix, sessionMaxExpiresAtUnix)
        : sessionExpiresAtUnix;
    return limit - Math.floor(Date.now() / 1000);
}

function updateSessionIndicator(): void {
    const remaining = computeSessionRemainingSecs();
    if (!sessionUnlocked || remaining === null) {
        sessionStateText.classList.add("hidden");
        sessionStateText.textContent = "";
        return;
    }

    const formatted = formatDuration(Math.max(0, remaining));
    sessionStateText.textContent = `Sessão ativa · expira em ${formatted ?? "instantes"}`;
    sessionStateText.classList.remove("hidden");
}

function startSessionTicker(): void {
    stopSessionTicker();
    sessionTickerInterval = window.setInterval(() => {
        void onSessionTick();
    }, SESSION_TICKER_INTERVAL_MS);
}

function stopSessionTicker(): void {
    if (sessionTickerInterval !== null) {
        clearInterval(sessionTickerInterval);
        sessionTickerInterval = null;
    }
}

async function onSessionTick(): Promise<void> {
    if (!sessionUnlocked) {
        stopSessionTicker();
        return;
    }

    const remaining = computeSessionRemainingSecs();
    if (remaining !== null && remaining <= 0) {
        // O TTL local pode estar defasado (cada operacao renova a sessao na API).
        // Confirma com o background antes de marcar como expirada.
        try {
            const status = await sendMessage<SessionStatusUiResult>({ type: "GET_SESSION_STATUS" });
            if (status.ok && status.data.unlocked) {
                applySessionWindow(status.data);
                return;
            }
        } catch (error) {
            console.warn("Falha ao revalidar sessao no ticker:", error);
        }

        handleSessionExpiredLocally();
        return;
    }

    updateSessionIndicator();
}

function handleSessionExpiredLocally(): void {
    sessionUnlocked = false;
    entriesCache = [];
    renderEntries();
    clearSessionWindow();
    resetEntryFormMode();
    syncSessionUi();
    setInteractive(true);
    setStatus("Sessão expirada. Faça unlock novamente.", "error");
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
        return "Senha mestra incorreta ou cofre inválido.";
    }
    if (code === "API_OFFLINE") {
        return "API local offline. Verifique se o app principal está em execução.";
    }
    if (code === "SESSION_EXPIRED") {
        return "Sessão expirada. Faça unlock novamente.";
    }
    if (code === "NOT_FOUND") {
        return "Credencial não encontrada ou sessão não existe mais.";
    }
    if (code === "BAD_REQUEST") {
        return "Dados inválidos enviados para a API local.";
    }
    if (code === "CONFLICT") {
        return "O recurso já existe e não pode ser criado novamente.";
    }
    if (code === "INVALID_RESPONSE") {
        return "Resposta inválida da API local.";
    }
    return "Falha inesperada na comunicação com a API local.";
}

function formatSessionWindow(session: { ttlSecs?: number; maxTtlSecs?: number }): string {
    const inactivity = formatDuration(session.ttlSecs);
    const maximum = formatDuration(session.maxTtlSecs);

    if (inactivity && maximum) {
        return `Inatividade: ${inactivity}. Limite máximo: ${maximum}.`;
    }

    if (inactivity) {
        return `Inatividade: ${inactivity}.`;
    }

    return "Sessão ativa.";
}

function formatDuration(totalSeconds: number | undefined): string | null {
    if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds)) {
        return null;
    }

    if (totalSeconds < 60) {
        return `${Math.max(0, Math.floor(totalSeconds))}s`;
    }

    const totalMinutes = Math.round(totalSeconds / 60);
    if (totalMinutes < 60) {
        return `${totalMinutes}min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${minutes}min`;
}

function describeAutofillReason(reason: string): string {
    if (reason === "PASSWORD_FIELD_NOT_FOUND") {
        return "campo de senha não encontrado na página";
    }
    if (reason === "USERNAME_FIELD_NOT_FOUND") {
        return "campo de usuário não encontrado para preencher junto com a senha";
    }
    if (reason === "NO_FILLABLE_FIELDS") {
        return "nenhum campo de login visível/editável foi detectado";
    }
    if (reason === "ACTIVE_TAB_NOT_FOUND") {
        return "nenhuma aba ativa disponível";
    }
    if (reason === "CONTENT_SCRIPT_UNREACHABLE") {
        return "content script não está acessível nesta página (ex.: chrome://, edge://, web store)";
    }
    if (reason === "CONTENT_SCRIPT_NO_RESPONSE") {
        return "content script não respondeu ao comando de autofill";
    }

    return "motivo desconhecido";
}

function mapAutofillFailureMessage(reason: string): string {
    if (reason === "CONTENT_SCRIPT_UNREACHABLE") {
        return "Não foi possível preencher nesta página. O site pode bloquear scripts (CSP/CORS/iframe).";
    }
    if (reason === "PASSWORD_FIELD_NOT_FOUND") {
        return "Campo de senha não encontrado nesta página.";
    }
    if (reason === "USERNAME_FIELD_NOT_FOUND") {
        return "Campo de usuário não encontrado nesta página.";
    }
    if (reason === "NO_FILLABLE_FIELDS") {
        return "Nenhum campo de login preenchível foi encontrado.";
    }

    return "Senha obtida, mas não foi possível preencher automaticamente nesta página.";
}

function describePostActionReason(reason: string): string {
    if (reason === "ELEMENT_NOT_FOUND") {
        return "elemento alvo do click não foi encontrado na página";
    }
    if (reason === "CLICK_ERROR") {
        return "houve erro ao executar o click configurado nas notas";
    }
    if (reason === "AUTOFILL_FAILED") {
        return "a ação não foi executada porque o autofill falhou";
    }
    if (reason === "PARSE_INVALID") {
        return "o comando das notas está em formato inválido";
    }
    if (reason === "NOT_CONFIGURED") {
        return "nenhuma ação de notas foi configurada";
    }

    return "a ação configurada nas notas não foi executada";
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
    const activeTab = await getActiveTabInfo();
    return activeTab?.url ?? null;
}

async function getActiveTabInfo(): Promise<chrome.tabs.Tab | null> {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return activeTab ?? null;
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

async function changePassword(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (!newPassword || !confirmPassword) {
        setStatus("Informe a nova senha e sua confirmação.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        setStatus("As senhas não coincidem.", "error");
        return;
    }

    closeChangePasswordModal();
    setStatus("Trocando senha mestra...");
    setButtonLoading(changePasswordBtn, true);

    let response: RuntimeResponse<ChangePasswordUiResult>;
    try {
        response = await sendMessage<ChangePasswordUiResult>({
            type: "CHANGE_MASTER_PASSWORD",
            newMasterPassword: newPassword,
            confirmNewMasterPassword: confirmPassword
        });
    } catch (error) {
        console.error("Falha ao trocar senha mestra via background:", error);
        setStatus("Falha ao trocar a senha mestra.", "error");
        return;
    } finally {
        setButtonLoading(changePasswordBtn, false);
    }

    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    applySessionWindow(response.data);
    setStatus(
        `Senha mestra trocada com sucesso. ${formatInvalidatedSessions(response.data.invalidatedSessions)} ${formatSessionWindow(response.data)}`,
        "success"
    );
}

function formatInvalidatedSessions(count: number): string {
    if (count === 0) {
        return "Nenhuma outra sessão foi invalidada.";
    }

    return count === 1 ? "1 outra sessão foi invalidada." : `${count} outras sessões foram invalidadas.`;
}

function openChangePasswordModal(): void {
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    changePasswordModal.showModal();
}

function closeChangePasswordModal(): void {
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    changePasswordModal.close();
}

function mustGetElement<T extends Element>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Elemento obrigatorio nao encontrado: ${id}`);
    }
    return element as unknown as T;
}
