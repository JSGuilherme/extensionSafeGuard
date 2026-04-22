import type { EntrySummary } from "./api.js";

export type RuntimeRequest =
  | { type: "HEALTH_CHECK" }
  | { type: "GET_VAULT_STATUS" }
  | { type: "CREATE_VAULT"; masterPassword: string }
  | { type: "UNLOCK"; masterPassword: string }
  | { type: "GET_SESSION_STATUS" }
  | { type: "LIST_ENTRIES" }
  | {
      type: "CREATE_ENTRY";
      service: string;
      username: string;
      password: string;
      url?: string;
      notes?: string;
    }
  | { type: "GET_ENTRY_PASSWORD"; entryId: string; username?: string }
  | { type: "GET_ENTRY_PASSWORD_VALUE"; entryId: string }
  | { type: "LOCK_SESSION" };

export type RuntimeResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface UnlockUiResult {
  expiresAtUnix: number;
  ttlSecs: number;
}

export interface VaultStatusUiResult {
  exists: boolean;
}

export interface CreateVaultUiResult {
  expiresAtUnix: number;
  ttlSecs: number;
}

export interface SessionStatusUiResult {
  unlocked: boolean;
  expiresAtUnix?: number;
  ttlSecs?: number;
}

export interface ListEntriesUiResult {
  entries: EntrySummary[];
}

export interface CreateEntryUiResult {
  entryId: string;
  created: boolean;
}

export interface GetPasswordUiResult {
  filled: boolean;
  reason?: string;
  reasonDetail?: string;
}

export interface GetPasswordValueUiResult {
  password: string;
}
