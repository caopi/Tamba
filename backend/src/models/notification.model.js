import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";

function mapNotification(linha) {
  return {
    id: linha.id,
    type: linha.type,
    catchId: linha.catch_id,
    isRead: Boolean(linha.is_read),
    createdAt: linha.created_at,
    actor: {
      id: linha.actor_id,
      name: linha.ator_name,
      nickname: linha.ator_nickname,
      avatarUrl: linha.ator_avatar_url,
    },
  };
}

/** `type`: 'like' | 'comment' | 'follow'. `catchId` é null para 'follow'. */
export async function create({ userId, type, actorId, catchId = null }, conn) {
  await query(
    "INSERT INTO notifications (id, user_id, type, actor_id, catch_id) VALUES (?, ?, ?, ?, ?)",
    [randomUUID(), userId, type, actorId, catchId],
    conn,
  );
}

export async function listForUser(userId, { unreadOnly, limit }) {
  const filtro = unreadOnly ? "AND n.is_read = FALSE" : "";
  const linhas = await query(
    `SELECT n.*, u.name AS ator_name, u.nickname AS ator_nickname, u.avatar_url AS ator_avatar_url
     FROM notifications n
     INNER JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = ? ${filtro}
     ORDER BY n.created_at DESC
     LIMIT ?`,
    // LIMIT como string: ver o comentário em catch.model.js (findFeed).
    [userId, String(limit)],
  );
  return linhas.map(mapNotification);
}

export async function countUnread(userId) {
  const linha = await queryOne(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = FALSE",
    [userId],
  );
  return linha.total;
}

/** Devolve se a notificação existe e é do usuário. */
export async function markRead(id, userId) {
  const linha = await queryOne("SELECT id FROM notifications WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  if (!linha) return false;
  await query("UPDATE notifications SET is_read = TRUE WHERE id = ?", [id]);
  return true;
}

export async function markAllRead(userId) {
  await query("UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE", [
    userId,
  ]);
}
