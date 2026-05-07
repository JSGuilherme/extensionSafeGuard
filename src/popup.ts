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
const RUNTIME_MESSAGE_TIMEOUT_MS = 3500;
const PAGE_METADATA_TIMEOUT_MS = 1500;
const THEME_STORAGE_KEY = "safeguard_theme";

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
let sessionUnlocked = false;
let vaultExists = true;
let currentTheme: ThemeMode = "dark";
let entryFormMode: EntryFormMode = "create";
let editingEntryState: EditingEntryState | null = null;
let notesLoadSequence = 0;

void initializeTheme();
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

createEntryBtn.addEventListener("click", () => {
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
    themeToggleBtn.setAttribute("data-balloon-pos", "left");
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
                "Nao foi possivel validar o status do cofre agora. Tentando restaurar a sessao local...",
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
        setStatus("Nao foi possivel verificar se o cofre existe. Tentando restaurar a sessao local...", "error");
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
            syncSessionUi();
            setStatus(`Sessao ativa restaurada. ${formatSessionWindow(sessionStatus.data)}`, "success");
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
        setStatus("Cofre nao encontrado. Clique em Cadastrar cofre para criar o primeiro cofre.", "error");
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
    setStatus(`Sessao desbloqueada. ${formatSessionWindow(response.data)}`, "success");
    sessionUnlocked = true;
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
    toggleLoading(true);

    const response = await sendMessage<CreateVaultUiResult>({
        type: "CREATE_VAULT",
        masterPassword
    });

    toggleLoading(false);

    if (!response.ok) {
        if (response.error.code === "CONFLICT") {
            vaultExists = true;
            syncVaultUi();
            setStatus("Cofre ja existe. Use Desbloquear para iniciar a sessao.", "error");
            return;
        }

        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    passwordInput.value = "";
    vaultExists = true;
    sessionUnlocked = true;
    syncVaultUi();
    syncSessionUi();
    setInteractive(true);
    setStatus(`Cofre cadastrado e sessao desbloqueada. ${formatSessionWindow(response.data)}`, "success");
    await loadEntries();
}

async function loadEntries(): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    console.info("[cofre-popup] loadEntries: solicitando LIST_ENTRIES.");
    setStatus("Atualizando credenciais...");

    const response = await sendMessage<ListEntriesUiResult>({ type: "LIST_ENTRIES" });
    if (!response.ok) {
        console.warn("[cofre-popup] loadEntries: LIST_ENTRIES retornou erro.", response.error);
        setStatus(mapFriendlyError(response.error.code), "error");
        if (response.error.code === "SESSION_EXPIRED" || response.error.code === "NOT_FOUND") {
            console.warn("[cofre-popup] loadEntries: tratando erro como sessao invalida/expirada.");
            entriesCache = [];
            sessionUnlocked = false;
            resetEntryFormMode();
            vaultExists = true;
            syncVaultUi();
            syncSessionUi();
            setInteractive(true);
            setStatus(
                response.error.code === "NOT_FOUND"
                    ? "Sessao invalida ou expirada. Faca unlock novamente."
                    : "Sessao expirada. Faca unlock novamente.",
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

    if (entriesCache.length === 0) {
        setStatus("Nenhuma credencial encontrada.");
        return;
    }

    setStatus(`${entriesCache.length} credencial(is) carregada(s).`);
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
        createEntryBtn.disabled = true;

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
            createEntryBtn.disabled = false;
            return;
        }

        createEntryBtn.disabled = false;

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
        setStatus("Nenhuma alteracao detectada para salvar.", "error");
        return;
    }

    setStatus("Salvando alteracoes...");
    createEntryBtn.disabled = true;

    let response: RuntimeResponse<EditEntryUiResult>;
    try {
        response = await sendMessage<EditEntryUiResult>({
            type: "EDIT_ENTRY",
            ...updatePayload
        });
    } catch (error) {
        console.error("Falha ao editar chave via background:", error);
        setStatus("Falha ao editar a chave.", "error");
        createEntryBtn.disabled = false;
        return;
    }

    createEntryBtn.disabled = false;

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

function renderEntries(): void {
    entriesList.textContent = "";

    for (const entry of entriesCache) {
        const item = document.createElement("li");
        item.className = "entry-item";

        const titleDiv = document.createElement("div");
        titleDiv.className = "entry-title";

        const title = document.createElement("div");
        title.textContent = `${entry.servico} - ${entry.usuario}`;

        const meta = document.createElement("a");
        meta.className = "entry-meta";
        meta.textContent = entry.url ?? "Sem URL cadastrada";
        if(entry.url){
            meta.setAttribute("href", entry.url);
            meta.setAttribute("target", "_blank");
        }

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

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "entry-action secondary";
        editButton.textContent = "Editar";
        editButton.addEventListener("click", () => {
            void startEditEntry(entry);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "entry-action danger";
        deleteButton.textContent = "Excluir";
        deleteButton.addEventListener("click", () => {
            void deleteEntry(entry);
        });

        titleDiv.append(title, meta);
        actions.append(autofillButton, copyButton, copyUserButton, editButton, deleteButton);
        item.append(titleDiv, actions);
        entriesList.append(item);
    }
}

async function deleteEntry(entry: EntrySummary): Promise<void> {
    if (!(await ensureBackendAvailable())) {
        return;
    }

    const confirmed = window.confirm(`Excluir a chave ${entry.servico} - ${entry.usuario}? Esta ação não pode ser desfeita.`);
    if (!confirmed) {
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
    setStatus("Chave excluida com sucesso.", "success");
    if (entriesCache.length === 0) {
        setStatus("Nenhuma credencial encontrada.");
    }
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
            setStatus("Editando chave. Nao foi possivel carregar as notas agora.", "error");
            return;
        }

        const notes = response.data.notes ?? "";
        editingEntryState.notas = notes;
        createNotesInput.value = notes;
        setStatus("Chave carregada para edicao.", "success");
    } catch (error) {
        console.warn("Falha ao carregar notas para edicao:", error);
        setStatus("Editando chave. Nao foi possivel carregar as notas agora.", "error");
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
        if (response.data.postActionAttempted && response.data.postActionExecuted) {
            setStatus("Autofill enviado e acoes automaticas executadas.", "success");
            return;
        }

        if (response.data.postActionReason === "PARSE_INVALID") {
            setStatus("Autofill enviado. A acao das notas foi ignorada por formato invalido.");
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

function setActiveTab(tab: "entries" | "create"): void {
    const entriesActive = tab === "entries";
    tabEntriesBtn.classList.toggle("active", entriesActive);
    tabCreateBtn.classList.toggle("active", !entriesActive);

    if (!sessionUnlocked) {
        entriesPanel.classList.add("hidden");
        createPanel.classList.add("hidden");
        return;
    }

    entriesPanel.classList.toggle("hidden", !entriesActive);
    createPanel.classList.toggle("hidden", entriesActive);
    if (tab === "entries") {
        if (entriesCache) {
            setStatus(`${entriesCache.length} credencial(is) carregada(s).`);
        } else {
            setStatus("Nenhuma credencial encontrada.");
        }
    } else {
        setStatus("Preencha os campos para cadastrar uma nova chave.");
        void prefillCreateFieldsFromActiveTab();
    }
}

function clearCreateForm(): void {
    createServiceInput.value = "";
    createUsernameInput.value = "";
    createPasswordInput.value = "";
    createUrlInput.value = "";
    createNotesInput.value = "";
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
    sessionUnlocked = false;
    resetEntryFormMode();
    syncSessionUi();
    setInteractive(true);
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
    //createVaultBtn.classList.remove("hidden");
    createVaultBtn.textContent = "Cadastrar cofre";
}

function syncSessionUi(): void {
    unlockPanel.classList.toggle("hidden", sessionUnlocked);
    lockBtn.classList.toggle("hidden", !sessionUnlocked);

    if (!sessionUnlocked) {
        entriesPanel.classList.add("hidden");
        createPanel.classList.add("hidden");
        passwordInput.focus();
        return;
    }

    setActiveTab(tabCreateBtn.classList.contains("active") ? "create" : "entries");
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
    if (code === "CONFLICT") {
        return "O recurso ja existe e nao pode ser criado novamente.";
    }
    if (code === "INVALID_RESPONSE") {
        return "Resposta invalida da API local.";
    }
    return "Falha inesperada na comunicacao com a API local.";
}

function formatSessionWindow(session: { ttlSecs?: number; maxTtlSecs?: number }): string {
    const inactivity = formatDuration(session.ttlSecs);
    const maximum = formatDuration(session.maxTtlSecs);

    if (inactivity && maximum) {
        return `Inatividade: ${inactivity}. Limite maximo: ${maximum}.`;
    }

    if (inactivity) {
        return `Inatividade: ${inactivity}.`;
    }

    return "Sessao ativa.";
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

function describePostActionReason(reason: string): string {
    if (reason === "ELEMENT_NOT_FOUND") {
        return "elemento alvo do click nao foi encontrado na pagina";
    }
    if (reason === "CLICK_ERROR") {
        return "houve erro ao executar o click configurado nas notas";
    }
    if (reason === "AUTOFILL_FAILED") {
        return "a acao nao foi executada porque o autofill falhou";
    }
    if (reason === "PARSE_INVALID") {
        return "o comando das notas esta em formato invalido";
    }
    if (reason === "NOT_CONFIGURED") {
        return "nenhuma acao de notas foi configurada";
    }

    return "a acao configurada nas notas nao foi executada";
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
        setStatus("Informe a nova senha e sua confirmacao.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        setStatus("As senhas nao coincidem.", "error");
        return;
    }

    if (newPassword.length < 1) {
        setStatus("A nova senha nao pode estar vazia.", "error");
        return;
    }

    closeChangePasswordModal();
    setStatus("Trocando senha mestra...");
    toggleLoading(true);

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
        toggleLoading(false);
        return;
    }

    toggleLoading(false);

    if (!response.ok) {
        setStatus(mapFriendlyError(response.error.code), "error");
        return;
    }

    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    setStatus(
        `Senha mestra trocada com sucesso. ${response.data.invalidatedSessions} outra(s) sessao(oes) foi(foram) invalidada(s). ${formatSessionWindow(response.data)}`,
        "success"
    );
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
