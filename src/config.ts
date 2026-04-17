export const API_BASE_URL = "http://127.0.0.1:5474";

export type AuthMode = "path" | "bearer";

// Ao migrar a API para Authorization Bearer, altere apenas este valor para "bearer".
export const API_AUTH_MODE: AuthMode = "path";
