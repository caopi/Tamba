import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";

export async function create(reporterId, catchId, reason, conn) {
  await query(
    "INSERT INTO reports (id, reporter_id, catch_id, reason) VALUES (?, ?, ?, ?)",
    [randomUUID(), reporterId, catchId, reason],
    conn,
  );
}

/**
 * Denúncias pendentes da captura. Como (reporter_id, catch_id) é UNIQUE, cada
 * linha é de um usuário diferente — a contagem já é de "usuários distintos".
 */
export async function countPending(catchId, conn) {
  const linha = await queryOne(
    "SELECT COUNT(*) AS total FROM reports WHERE catch_id = ? AND status = 'pendente'",
    [catchId],
    conn,
  );
  return linha.total;
}

/** Fila de moderação: denúncias pendentes, mais antigas primeiro. */
export async function listPending() {
  const linhas = await query(
    `SELECT r.id, r.catch_id, r.reason, r.created_at,
            u.id AS denunciante_id, u.nickname AS denunciante_nickname
     FROM reports r
     INNER JOIN users u ON u.id = r.reporter_id
     WHERE r.status = 'pendente'
     ORDER BY r.created_at ASC`,
  );
  return linhas.map((linha) => ({
    id: linha.id,
    catchId: linha.catch_id,
    reason: linha.reason,
    createdAt: linha.created_at,
    reporter: { id: linha.denunciante_id, nickname: linha.denunciante_nickname },
  }));
}

/** Todas as denúncias de uma captura (pendentes primeiro), para o painel do admin. */
export async function listByCatch(catchId) {
  const linhas = await query(
    `SELECT r.id, r.reason, r.status, r.created_at,
            u.id AS denunciante_id, u.nickname AS denunciante_nickname
     FROM reports r
     INNER JOIN users u ON u.id = r.reporter_id
     WHERE r.catch_id = ?
     ORDER BY r.status = 'pendente' DESC, r.created_at ASC`,
    [catchId],
  );
  return linhas.map((linha) => ({
    id: linha.id,
    reason: linha.reason,
    status: linha.status,
    createdAt: linha.created_at,
    reporter: { id: linha.denunciante_id, nickname: linha.denunciante_nickname },
  }));
}

export async function markReviewed(catchId, conn) {
  await query(
    "UPDATE reports SET status = 'analisado' WHERE catch_id = ? AND status = 'pendente'",
    [catchId],
    conn,
  );
}
