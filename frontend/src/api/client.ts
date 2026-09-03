const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api";

const TOKEN_KEY = "tamba:token";

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Erro de API com o status HTTP junto, para as telas tratarem 401 etc. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Wrapper único em volta do fetch: monta a URL, injeta o token e transforma
 * resposta de erro em `ApiError`. Todo acesso à API passa por aqui.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? "Erro ao falar com o servidor", response.status);
  }

  return body as T;
}
