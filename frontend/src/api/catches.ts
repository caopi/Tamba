import { api } from "./client";
import type { Catch, CatchInput } from "../types";

export const catchesApi = {
  /** Histórico do usuário logado, incluindo as ocultas (com isHidden). */
  list: () => api<Catch[]>("/catches"),

  create: (data: CatchInput) =>
    api<Catch>("/catches", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<CatchInput>) =>
    api<Catch>(`/catches/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  remove: (id: string) => api<void>(`/catches/${id}`, { method: "DELETE" }),
};
