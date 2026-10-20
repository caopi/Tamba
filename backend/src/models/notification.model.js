import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";
import { publicUrl } from "../lib/storage.js";

function mapNotification(linha) {
  return {
    id: linha.id,
    type: linha.type,
    catchId: linha.catch_id,
    // Nome da espécie da captura, para o texto ("curtiu seu Tucunaré").
    speciesName: linha.especie_name ?? null,
    // A captura do destinatário foi ocultada por denúncias depois do aviso:
    // ele ainda a abre (é o autor), com o selo "em análise".
    catchIsHidden: Boolean(linha.captura_is_hidden),
    isRead: Boolean(linha.is_read),
    createdAt: linha.created_at,
    actor: {
      id: linha.actor_id,
      name: linha.ator_name,
      nickname: linha.ator_nickname,
      avatarUrl: publicUrl(linha.ator_avatar_url),
    },
  };
}

// Tipo da notificação -> coluna de preferência do destinatário (UC007).
// Whitelist: o nome da coluna nunca vem de fora.
const PREFERENCIA = {
  like: "notify_likes",
  comment: "notify_comments",
  follow: "notify_follows",
};

/**
 * `type`: 'like' | 'comment' | 'follow'. `catchId` é null para 'follow'.
 *
 * Só grava se o destinatário quer esse tipo de aviso: o INSERT ... SELECT
 * não devolve linha quando a preferência está desligada. Como é o único
 * lugar que cria notificação, a preferência vale para todo o app.
 *
 * Curtida e follow avisam uma vez por par: descurtir e curtir de novo (ou
 * deixar de seguir e voltar) não gera um segundo aviso. Comentário avisa
 * sempre — cada um é um texto novo.
 */
export async function create({ userId, type, actorId, catchId = null }, conn) {
  const coluna = PREFERENCIA[type];
  if (!coluna) throw new Error(`Tipo de notificação desconhecido: ${type}`);

  const params = [randomUUID(), type, actorId, catchId, userId];
  let semRepetir = "";
  if (type !== "comment") {
    // `<=>` compara NULL com NULL (catch_id do follow).
    semRepetir = `AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = ? AND n.type = ? AND n.actor_id = ? AND n.catch_id <=> ?)`;
    params.push(userId, type, actorId, catchId);
  }

  await query(
    `INSERT INTO notifications (id, user_id, type, actor_id, catch_id)
     SELECT ?, id, ?, ?, ? FROM users WHERE id = ? AND ${coluna} = TRUE ${semRepetir}`,
    params,
    conn,
  );
}

// RGN-12: aviso de quem foi desativado não aparece (o perfil dele não abre
// mais). É filtro na leitura, não DELETE: se o admin reativar a conta, os
// avisos voltam. Captura apagada leva as notificações junto (CASCADE).
const VISIVEL = "n.user_id = ? AND u.is_active = TRUE";

/**
 * Página de notificações, mais recentes primeiro. `before` é o
 * `{ createdAt, id }` do último item da página anterior; o id desempata
 * avisos criados no mesmo milissegundo.
 */
export async function listForUser(userId, { unreadOnly, before, limit }) {
  const condicoes = [VISIVEL];
  const params = [userId];
  if (unreadOnly) condicoes.push("n.is_read = FALSE");
  if (before) {
    condicoes.push("(n.created_at < ? OR (n.created_at = ? AND n.id < ?))");
    params.push(before.createdAt, before.createdAt, before.id);
  }
  // LIMIT como string: ver o comentário em catch.model.js (findFeed).
  params.push(String(limit));

  const linhas = await query(
    `SELECT n.*, u.name AS ator_name, u.nickname AS ator_nickname, u.avatar_url AS ator_avatar_url,
            s.name AS especie_name, c.is_hidden AS captura_is_hidden
     FROM notifications n
     INNER JOIN users u ON u.id = n.actor_id
     LEFT JOIN catches c ON c.id = n.catch_id
     LEFT JOIN fish_species s ON s.id = c.species_id
     WHERE ${condicoes.join(" AND ")}
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT ?`,
    params,
  );
  return linhas.map(mapNotification);
}

/** Mesmo filtro da lista: o número do sino bate com o que a tela mostra. */
export async function countUnread(userId) {
  const linha = await queryOne(
    `SELECT COUNT(*) AS total
     FROM notifications n INNER JOIN users u ON u.id = n.actor_id
     WHERE ${VISIVEL} AND n.is_read = FALSE`,
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
