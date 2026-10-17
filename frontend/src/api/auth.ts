import { api } from "./client";
import type { AuthResponse, SignupInput, User } from "../types";

export const authApi = {
  /** Cria a conta inativa. Não devolve token: o login só depois de confirmar. */
  signup: (data: SignupInput) =>
    api<{ user: User; message: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    api<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  /** Gera um link novo. A resposta é a mesma exista o e-mail ou não. */
  resendVerification: (email: string) =>
    api<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  me: () => api<User>("/auth/me"),
};
