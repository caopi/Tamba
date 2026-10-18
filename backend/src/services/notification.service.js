// Notificações do usuário logado (UC009, REQ-43). Quem cria é o
// social.service (curtida, comentário, follow); aqui só se lê e marca como lida.

import { z } from "zod";
import * as notificationModel from "../models/notification.model.js";
import { httpError } from "../middlewares/errorHandler.js";

const listSchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
  // Cursor opaco devolvido em `nextCursor`: "<createdAt ISO>_<id>".
  cursor: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function lerCursor(cursor) {
  const [data, id] = cursor.split("_");
  const createdAt = new Date(data);
  if (Number.isNaN(createdAt.getTime()) || !id) throw httpError(400, "Cursor inválido");
  return { createdAt, id };
}

export async function listNotifications(userId, entrada) {
  const { unreadOnly, cursor, limit } = listSchema.parse(entrada);
  const [items, unreadCount] = await Promise.all([
    notificationModel.listForUser(userId, {
      unreadOnly,
      before: cursor ? lerCursor(cursor) : null,
      limit,
    }),
    notificationModel.countUnread(userId),
  ]);

  let nextCursor = null;
  if (items.length === limit) {
    const ultimo = items.at(-1);
    nextCursor = `${new Date(ultimo.createdAt).toISOString()}_${ultimo.id}`;
  }
  return { items, unreadCount, nextCursor };
}

/** Só o número, para o sino do topo (consultado de tempos em tempos). */
export async function unreadCount(userId) {
  return { unreadCount: await notificationModel.countUnread(userId) };
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
