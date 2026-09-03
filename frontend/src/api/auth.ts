import { api } from "./client";
import type { AuthResponse, User } from "../types";

export const authApi = {
  signup: (data: { name: string; email: string; password: string }) =>
    api<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    api<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  me: () => api<User>("/auth/me"),
};
