import { api } from "./client";
import type { AuthResponse, SignupInput, SignupResponse, User } from "../types";

export const authApi = {
  /**
   * Cria a conta. Com a confirmação de e-mail ligada no backend
   * (REQUIRE_EMAIL_VERIFICATION), vem `token: null` e `requiresVerification:
   * true`; desligada, a conta já vem ativa e com token.
   */
  signup: (data: SignupInput) =>
    api<SignupResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),

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
