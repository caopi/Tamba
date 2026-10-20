import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";
import { publicUrl } from "../lib/storage.js";

const SELECT_COMPLETO = `
  SELECT m.id, m.catch_id, m.user_id, m.body, m.created_at,
         u.name AS autor_name, u.nickname AS autor_nickname, u.avatar_url AS autor_avatar_url
  FROM comments m
  INNER JOIN users u ON u.id = m.user_id
`;

function mapComment(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    catchId: linha.catch_id,
    body: linha.body,
    createdAt: linha.created_at,
    author: {
      id: linha.user_id,
      name: linha.autor_name,
      nickname: linha.autor_nickname,
      avatarUrl: publicUrl(linha.autor_avatar_url),
    },
  };
}

export async function findById(id, conn) {
  return mapComment(await queryOne(`${SELECT_COMPLETO} WHERE m.id = ?`, [id], conn));
}

/** Mais antigos primeiro, como numa conversa. */
export async function listByCatch(catchId) {
  const linhas = await query(
    `${SELECT_COMPLETO} WHERE m.catch_id = ? AND u.is_active = TRUE ORDER BY m.created_at ASC`,
    [catchId],
  );
  return linhas.map(mapComment);
}

export async function create(userId, catchId, body, conn) {
  const id = randomUUID();
  await query(
    "INSERT INTO comments (id, catch_id, user_id, body) VALUES (?, ?, ?, ?)",
    [id, catchId, userId, body],
    conn,
  );
  return findById(id, conn);
}

/** Só apaga se o comentário for do usuário. Devolve quantas linhas saíram. */
export async function deleteForUser(id, userId) {
  const resultado = await query("DELETE FROM comments WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  return resultado.affectedRows;
}
