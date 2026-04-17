export interface HealthResponse {
  status: string;
  now_unix: number;
}

export interface UnlockRequest {
  master_password: string;
}

export interface UnlockResponse {
  session_token: string;
  expires_at_unix: number;
  ttl_secs: number;
}

export interface EntrySummary {
  id: string;
  servico: string;
  usuario: string;
  url?: string;
  atualizado_em: string;
}

export interface ListEntriesResponse {
  entries: EntrySummary[];
}

export interface EntryPasswordResponse {
  senha: string;
}

export type ApiErrorCode =
  | "API_OFFLINE"
  | "INVALID_RESPONSE"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SESSION_EXPIRED"
  | "UNKNOWN";

export class ApiClientError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status?: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
