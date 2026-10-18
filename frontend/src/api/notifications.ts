import { api } from "./client";
import type { NotificationPage } from "../types";

/** UC009: notificações do usuário logado. */
export const notificationsApi = {
  list: (params: { cursor?: string | null; limit?: number } = {}) => {
    const busca = new URLSearchParams();
    if (params.cursor) busca.set("cursor", params.cursor);
    if (params.limit) busca.set("limit", String(params.limit));
    return api<NotificationPage>(`/notifications?${busca}`);
  },
  /** Só o número do sino; o topo consulta de tempos em tempos. */
  unreadCount: () => api<{ unreadCount: number }>("/notifications/unread-count"),
  markRead: (id: string) => api<void>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => api<void>("/notifications/read-all", { method: "POST" }),
};
