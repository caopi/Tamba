import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";

export function mapSpot(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.name,
    location: linha.location,
    googlePlaceId: linha.google_place_id,
    isActive: Boolean(linha.is_active),
  };
}

/** Por padrão só os ativos; o admin pode pedir os desativados também. */
export async function findAll({ includeInactive = false } = {}) {
  const filtro = includeInactive ? "" : "WHERE is_active = TRUE";
  const linhas = await query(`SELECT * FROM fishing_spots ${filtro} ORDER BY name ASC, location ASC`);
  return linhas.map(mapSpot);
}

export async function findById(id) {
  return mapSpot(await queryOne("SELECT * FROM fishing_spots WHERE id = ?", [id]));
}

export async function exists(id) {
  return (await queryOne("SELECT id FROM fishing_spots WHERE id = ?", [id])) !== null;
}

/**
 * O par (name, location) já existe? É a chave única da migration 019; a
 * collation ignora caixa e acento, como o índice.
 */
export async function pairTaken(name, location, exceptId = null) {
  const linha = await queryOne(
    "SELECT id FROM fishing_spots WHERE name = ? AND location = ? AND (? IS NULL OR id <> ?)",
    [name, location, exceptId, exceptId],
  );
  return linha !== null;
}

// Whitelist campo da API -> coluna. Só o spot.service grava, depois do
// assertAdmin.
const COLUNAS = {
  name: "name",
  location: "location",
  isActive: "is_active",
};

export async function create(dados) {
  const id = randomUUID();
  const colunas = ["id"];
  const valores = [id];

  for (const [campo, coluna] of Object.entries(COLUNAS)) {
    if (campo in dados) {
      colunas.push(coluna);
      valores.push(dados[campo]);
    }
  }

  await query(
    `INSERT INTO fishing_spots (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`,
    valores,
  );
  return findById(id);
}

export async function update(id, dados) {
  const atribuicoes = [];
  const valores = [];

  for (const [campo, coluna] of Object.entries(COLUNAS)) {
    if (campo in dados) {
      atribuicoes.push(`${coluna} = ?`);
      valores.push(dados[campo]);
    }
  }
  if (atribuicoes.length === 0) return;

  valores.push(id);
  await query(`UPDATE fishing_spots SET ${atribuicoes.join(", ")} WHERE id = ?`, valores);
}

/**
 * Apaga só se nenhuma captura aponta para ele, num comando só: a FK é
 * SET NULL e não barraria, então conferir antes e apagar depois deixaria
 * escapar uma captura salva no meio. Devolve 0 quando havia captura.
 */
export async function removeIfUnused(id) {
  const resultado = await query(
    "DELETE FROM fishing_spots WHERE id = ? AND NOT EXISTS (SELECT 1 FROM catches WHERE spot_id = ?)",
    [id, id],
  );
  return resultado.affectedRows;
}
