interface AutofillMessage {
  type: "AUTOFILL_CREDENTIAL";
  payload: {
    username?: string;
    password: string;
    postAction?: AutofillPostAction[];
  };
}

interface AutofillPostAction {
  type: "click";
  selector: string;
}

type AutofillReason =
  | "PASSWORD_FIELD_NOT_FOUND"
  | "USERNAME_FIELD_NOT_FOUND"
  | "NO_FILLABLE_FIELDS";

type PostActionReason =
  | "NOT_CONFIGURED"
  | "PARSE_INVALID"
  | "AUTOFILL_FAILED"
  | "ELEMENT_NOT_FOUND"
  | "CLICK_ERROR"
  | "EXECUTED";

interface AutofillResult {
  filled: boolean;
  reason?: AutofillReason;
  reasonDetail?: string;
  postActionAttempted?: boolean;
  postActionExecuted?: boolean;
  postActionReason?: PostActionReason;
}

const globalState = globalThis as typeof globalThis & {
  __safeGuardAutofillListener?: (message: AutofillMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response?: AutofillResult) => void) => void;
};

if (globalState.__safeGuardAutofillListener) {
  chrome.runtime.onMessage.removeListener(globalState.__safeGuardAutofillListener);
}

globalState.__safeGuardAutofillListener = (message: AutofillMessage, _sender, sendResponse) => {
  if (message.type !== "AUTOFILL_CREDENTIAL") {
    return;
  }

  console.info("[cofre-content] Iniciando autofill na pagina atual.");
  const result = autofill(message.payload.username, message.payload.password, message.payload.postAction);
  console.info("[cofre-content] Resultado do autofill:", result);
  sendResponse(result);
};

chrome.runtime.onMessage.addListener(globalState.__safeGuardAutofillListener);

function autofill(
  username: string | undefined,
  password: string,
  postAction?: AutofillPostAction[]
): AutofillResult {
  const { selected: passwordField, all: passwordCandidates, fillable: fillablePasswordCandidates } =
    findPasswordField();
  const { selected: usernameField, all: usernameCandidates, fillable: fillableUsernameCandidates } =
    findUsernameField();

  console.info("[cofre-content] Campos de senha encontrados:", {
    total: passwordCandidates.length,
    fillable: fillablePasswordCandidates.length,
    selected: summarizeInput(passwordField),
    candidates: passwordCandidates.map(summarizeInput)
  });

  console.info("[cofre-content] Campos de usuario encontrados:", {
    total: usernameCandidates.length,
    fillable: fillableUsernameCandidates.length,
    selected: summarizeInput(usernameField),
    candidates: usernameCandidates.map(summarizeInput)
  });

  const hasUsernameToFill = Boolean(username);
  const canFillPassword = Boolean(passwordField);
  const canFillUsername = !hasUsernameToFill || Boolean(usernameField);

  if (!canFillPassword && !(hasUsernameToFill && canFillUsername)) {
    return { filled: false, reason: "NO_FILLABLE_FIELDS", postActionReason: "AUTOFILL_FAILED" };
  }

  if (username && usernameField) {
    fillInput(usernameField, username);
  }

  if (passwordField) {
    fillInput(passwordField, password);
  }

  const postActionResult = runPostAction(postAction);

  return {
    filled: true,
    postActionAttempted: postActionResult.attempted,
    postActionExecuted: postActionResult.executed,
    postActionReason: postActionResult.reason,
    reasonDetail: postActionResult.reasonDetail
  };
}

function runPostAction(actions?: AutofillPostAction[]): {
  attempted: boolean;
  executed: boolean;
  reason: PostActionReason;
  reasonDetail?: string;
} {
  if (!actions || actions.length === 0) {
    return {
      attempted: false,
      executed: false,
      reason: "NOT_CONFIGURED"
    };
  }

  for (const [index, action] of actions.entries()) {
    const result = runClickAction(action, index);
    if (!result.executed) {
      return result;
    }
  }

  return {
    attempted: true,
    executed: true,
    reason: "EXECUTED"
  };
}

function runClickAction(
  action: AutofillPostAction,
  index: number
): {
  attempted: boolean;
  executed: boolean;
  reason: PostActionReason;
  reasonDetail?: string;
} {
  if (action.type !== "click" || typeof action.selector !== "string" || action.selector.trim().length === 0) {
    return {
      attempted: true,
      executed: false,
      reason: "PARSE_INVALID",
      reasonDetail: `Acao ${index + 1} esta em formato invalido.`
    };
  }

  const selector = action.selector.trim();

  let target: Element | null;
  try {
    target = document.querySelector(selector);
  } catch (error) {
    return {
      attempted: true,
      executed: false,
      reason: "CLICK_ERROR",
      reasonDetail:
        error instanceof Error
          ? `Acao ${index + 1}: ${error.message}`
          : `Acao ${index + 1}: seletor CSS invalido para click.`
    };
  }

  if (!target) {
    return {
      attempted: true,
      executed: false,
      reason: "ELEMENT_NOT_FOUND",
      reasonDetail: `Acao ${index + 1}: elemento nao encontrado para ${selector}.`
    };
  }

  try {
    if (target instanceof HTMLElement) {
      target.click();
    } else {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }

    return {
      attempted: true,
      executed: true,
      reason: "EXECUTED"
    };
  } catch (error) {
    return {
      attempted: true,
      executed: false,
      reason: "CLICK_ERROR",
      reasonDetail:
        error instanceof Error
          ? `Acao ${index + 1}: ${error.message}`
          : `Acao ${index + 1}: falha ao executar click no elemento alvo.`
    };
  }
}

function findPasswordField(): {
  selected: HTMLInputElement | null;
  all: HTMLInputElement[];
  fillable: HTMLInputElement[];
} {
  const all = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='password']"));
  const fillable = all.filter((input) => isFillable(input));
  return { selected: fillable[0] ?? null, all, fillable };
}

function findUsernameField(): {
  selected: HTMLInputElement | null;
  all: HTMLInputElement[];
  fillable: HTMLInputElement[];
} {
  const all = Array.from(
    document.querySelectorAll("input[type='text'], input[type='email'], input:not([type]), input[name='user']")
  ) as HTMLInputElement[];

  const fillable = all.filter(isFillable).sort((a, b) => scoreUsernameField(b) - scoreUsernameField(a));
  return { selected: fillable[0] ?? null, all, fillable };
}

function scoreUsernameField(input: HTMLInputElement): number {
  const text = `${input.name} ${input.id} ${input.autocomplete}`.toLowerCase();
  let score = 0;
  if (text.includes("user")) score += 3;
  if (text.includes("mail")) score += 2;
  if (text.includes("login")) score += 2;
  if (text.includes("nome")) score += 1;
  return score;
}

function isFillable(input: HTMLInputElement): boolean {
  return !input.disabled && !input.readOnly && input.offsetParent !== null;
}

function fillInput(input: HTMLInputElement, value: string): void {
  console.info("[cofre-content] Tentando preencher campo:", {
    ...summarizeInput(input),
    valueLength: value.length
  });

  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  const looksFilled = input.value.length > 0;
  console.info("[cofre-content] Campo apos tentativa de preenchimento:", {
    ...summarizeInput(input),
    looksFilled
  });
}

function summarizeInput(input: HTMLInputElement | null): Record<string, unknown> | null {
  if (!input) {
    return null;
  }

  return {
    tag: input.tagName.toLowerCase(),
    type: input.type,
    id: input.id,
    name: input.name,
    autocomplete: input.autocomplete,
    placeholder: input.placeholder,
    disabled: input.disabled,
    readOnly: input.readOnly,
    visible: input.offsetParent !== null
  };
}
