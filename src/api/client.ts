import type { AuthMode } from "../config.js";
import type {
  EntryPasswordResponse,
  HealthResponse,
  ListEntriesResponse,
  UnlockRequest,
  UnlockResponse,
  VaultStatusResponse
} from "../types/api.js";
import { ApiClientError } from "../types/api.js";
import type { CreateEntryUiResult } from "../types/messages.js";

interface CreateEntryApiResponse {
  entry_id?: string;
  entryId?: string;
  created?: boolean;
}

interface ApiClientOptions {
  baseUrl: string;
  authMode: AuthMode;
}

const REQUEST_TIMEOUT_MS = 2500;

export class LocalApiClient {
  private readonly baseUrl: string;
  private readonly authMode: AuthMode;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.authMode = options.authMode;
  }

  async health(): Promise<HealthResponse> {
    const payload = await this.requestJson<HealthResponse>("/api/v1/health", {
      method: "GET"
    });

    if (typeof payload.status !== "string" || typeof payload.now_unix !== "number") {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta invalida no endpoint de health.");
    }

    return payload;
  }

  async unlock(body: UnlockRequest): Promise<UnlockResponse> {
    let payload: UnlockResponse;
    try {
      payload = await this.requestJson<UnlockResponse>("/api/v1/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        throw new ApiClientError("UNAUTHORIZED", "Senha mestra incorreta ou cofre invalido.", 401);
      }
      throw error;
    }

    if (
      typeof payload.session_token !== "string" ||
      typeof payload.expires_at_unix !== "number" ||
      typeof payload.ttl_secs !== "number"
    ) {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta invalida no endpoint de unlock.");
    }

    return payload;
  }

  async getVaultStatus(): Promise<VaultStatusResponse> {
    const payload = await this.requestJson<VaultStatusResponse>("/api/v1/vault", {
      method: "GET"
    });

    if (typeof payload.exists !== "boolean") {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta invalida no endpoint de status do cofre.");
    }

    return payload;
  }

  async createVault(body: UnlockRequest): Promise<UnlockResponse> {
    const payload = await this.requestJson<UnlockResponse>("/api/v1/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (
      typeof payload.session_token !== "string" ||
      typeof payload.expires_at_unix !== "number" ||
      typeof payload.ttl_secs !== "number"
    ) {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta invalida no endpoint de criacao de cofre.");
    }

    return payload;
  }

  async listEntries(sessionToken: string): Promise<ListEntriesResponse> {
    const auth = this.buildAuth(sessionToken, {
      pathWithToken: `/api/v1/entries/${encodeURIComponent(sessionToken)}`,
      pathWithBearer: "/api/v1/entries"
    });

    const payload = await this.requestJson<ListEntriesResponse>(auth.path, {
      method: "GET",
      headers: auth.headers
    });

    if (!Array.isArray(payload.entries)) {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta invalida no endpoint de listagem.");
    }

    return payload;
  }

  async createEntry(
    sessionToken: string,
    body: {
      servico: string;
      usuario: string;
      senha: string;
      url?: string;
      notas?: string;
    }
  ): Promise<CreateEntryUiResult> {
    const auth = this.buildAuth(sessionToken, {
      pathWithToken: `/api/v1/entries/${encodeURIComponent(sessionToken)}`,
      pathWithBearer: "/api/v1/entries"
    });

    const payload = await this.requestJson<CreateEntryApiResponse>(auth.path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth.headers ?? {})
      },
      body: JSON.stringify(body)
    });

    const entryId = payload.entry_id ?? payload.entryId;
    if (typeof entryId !== "string" || typeof payload.created !== "boolean") {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta invalida no endpoint de cadastro.");
    }

    return {
      entryId,
      created: payload.created
    };
  }

  async getEntryPassword(sessionToken: string, entryId: string): Promise<EntryPasswordResponse> {
    const auth = this.buildAuth(sessionToken, {
      pathWithToken: `/api/v1/entries/${encodeURIComponent(sessionToken)}/${encodeURIComponent(entryId)}/password`,
      pathWithBearer: `/api/v1/entries/${encodeURIComponent(entryId)}/password`
    });

    const payload = await this.requestJson<EntryPasswordResponse>(auth.path, {
      method: "GET",
      headers: auth.headers
    });

    if (typeof payload.senha !== "string") {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta invalida no endpoint de senha.");
    }

    return payload;
  }

  async lockSession(sessionToken: string): Promise<void> {
    const auth = this.buildAuth(sessionToken, {
      pathWithToken: `/api/v1/lock/${encodeURIComponent(sessionToken)}`,
      pathWithBearer: "/api/v1/lock"
    });

    await this.requestNoContent(auth.path, {
      method: "POST",
      headers: auth.headers
    });
  }

  private buildAuth(
    sessionToken: string,
    routes: { pathWithToken: string; pathWithBearer: string }
  ): { path: string; headers?: HeadersInit } {
    if (this.authMode === "bearer") {
      return {
        path: routes.pathWithBearer,
        headers: { Authorization: `Bearer ${sessionToken}` }
      };
    }

    return { path: routes.pathWithToken };
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.safeFetch(path, init);

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiClientError("INVALID_RESPONSE", "Resposta JSON invalida da API local.", response.status);
    }

    return payload as T;
  }

  private async requestNoContent(path: string, init: RequestInit): Promise<void> {
    const response = await this.safeFetch(path, init);
    if (!response.ok) {
      throw await this.toApiError(response);
    }
  }

  private async safeFetch(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiClientError(
          "API_OFFLINE",
          `API local nao respondeu em ${REQUEST_TIMEOUT_MS}ms.`
        );
      }
      throw new ApiClientError("API_OFFLINE", "Nao foi possivel conectar na API local.");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async toApiError(response: Response): Promise<ApiClientError> {
    if (response.status === 400) {
      return new ApiClientError("BAD_REQUEST", "Requisicao invalida.", 400);
    }
    if (response.status === 401) {
      return new ApiClientError("SESSION_EXPIRED", "Sessao invalida ou expirada.", 401);
    }
    if (response.status === 409) {
      return new ApiClientError("CONFLICT", "Recurso ja existe.", 409);
    }
    if (response.status === 404) {
      return new ApiClientError("NOT_FOUND", "Recurso nao encontrado.", 404);
    }

    return new ApiClientError("UNKNOWN", `Erro inesperado da API local (${response.status}).`, response.status);
  }
}
