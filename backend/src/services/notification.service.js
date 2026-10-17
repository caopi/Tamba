// Notificações do usuário logado. Quem cria é o social.service (curtida,
// comentário, follow); aqui só se lê e marca como lida.

import { z } from "zod";
import * as notificationModel from "../models/notification.model.js";
import { httpError } from "../middlewares/errorHandler.js";

const listSchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function listNotifications(userId, entrada) {
  const filtros = listSchema.parse(entrada);
  const [items, unreadCount] = await Promise.all([
    notificationModel.listForUser(userId, filtros),
    notificationModel.countUnread(userId),
  ]);
  return { items, unreadCount };
}

/** Só marca notificação do próprio usuário; a de outro responde 404. */
export async function markRead(userId, notificationId) {
  if (!(await notificationModel.markRead(notificationId, userId))) {
    throw httpError(404, "Notificação não encontrada");
  }
}

export async function markAllRead(userId) {
  await notificationModel.markAllRead(userId);
}
