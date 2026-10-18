import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";
import { publicUrl } from "../lib/storage.js";

// O mysql2 devolve DECIMAL como string (para não perder precisão). As faixas
// cabem tranquilamente num number do JS.
const numeroOuNull = (valor) => (valor === null || valor === undefined ? null : Number(valor));

export function mapSpecies(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.name,
    scientificName: linha.scientific_name,
    habitat: linha.habitat,
    // Foto do repositório ou enviada pelo admin: o publicUrl resolve as duas.
    imageUrl: publicUrl(linha.image_url),
    // Miniatura da grade da Dex (migrations 014 e 015).
    imageThumbUrl: publicUrl(linha.image_thumb_url),
    imageCredit: linha.image_credit,
    imageLicense: linha.image_license,
    imageSourceUrl: linha.image_source_url,
    imageCaption: linha.image_caption,
    // Reservado (migration 013): ninguém grava ainda.
    modelUrl: linha.model_url,
    recommendedBaits: linha.recommended_baits,
    rarity: linha.rarity,
    minWeight: numeroOuNull(linha.min_weight),
    maxWeight: numeroOuNull(linha.max_weight),
    minLength: numeroOuNull(linha.min_length),
    maxLength: numeroOuNull(linha.max_length),
    curiosities: linha.curiosities,
    isActive: Boolean(linha.is_active),
  };
}

/** Por padrão só as ativas; o admin pode pedir as desativadas também. */
export async function findAll({ includeInactive = false } = {}) {
  const filtro = includeInactive ? "" : "WHERE is_active = TRUE";
  const linhas = await query(`SELECT * FROM fish_species ${filtro} ORDER BY name ASC`);
  return linhas.map(mapSpecies);
}

export async function findById(id) {
  return mapSpecies(await queryOne("SELECT * FROM fish_species WHERE id = ?", [id]));
}

/** Só checa existência, sem trazer a linha inteira. */
export async function exists(id) {
  return (await queryOne("SELECT id FROM fish_species WHERE id = ?", [id])) !== null;
}

export async function nameTaken(name, exceptId = null) {
  const linha = await queryOne(
    "SELECT id FROM fish_species WHERE name = ? AND (? IS NULL OR id <> ?)",
    [name, exceptId, exceptId],
  );
  return linha !== null;
}

export async function hasCatches(id) {
  return (await queryOne("SELECT id FROM catches WHERE species_id = ? LIMIT 1", [id])) !== null;
}

// Whitelist campo da API -> coluna. Vale para o INSERT e para o UPDATE.
//
// RGN-11: `create` e `update` daqui são o único caminho do código da API que
// grava em fish_species — `rarity` incluída — e só o species.service os
// chama, sempre depois do assertAdmin. Nenhuma outra tabela tem raridade.
const COLUNAS = {
  name: "name",
  scientificName: "scientific_name",
  habitat: "habitat",
  imageUrl: "image_url",
  // Não vem do cliente (não está no schema): o species.service gera.
  imageThumbUrl: "image_thumb_url",
  imageCredit: "image_credit",
  imageLicense: "image_license",
  imageSourceUrl: "image_source_url",
  imageCaption: "image_caption",
  recommendedBaits: "recommended_baits",
  rarity: "rarity",
  minWeight: "min_weight",
  maxWeight: "max_weight",
  minLength: "min_length",
  maxLength: "max_length",
  curiosities: "curiosities",
  isActive: "is_active",
};

export async function create(dados) {
  const id = randomUUID();
  const colunas = ["id"];
  const valores = [id];

  for (const [campo, coluna] of Object.entries(COLUNAS)) {
    if (campo in dados) {
      colunas.push(coluna);
      valores.push(dados[campo] ?? null);
    }
  }

  await query(
    `INSERT INTO fish_species (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`,
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
      valores.push(dados[campo] ?? null);
    }
  }
  if (atribuicoes.length === 0) return;

  valores.push(id);
  await query(`UPDATE fish_species SET ${atribuicoes.join(", ")} WHERE id = ?`, valores);
}

export async function remove(id) {
  const resultado = await query("DELETE FROM fish_species WHERE id = ?", [id]);
  return resultado.affectedRows;
}

/**
 * A Dex de um usuário: todas as espécies com o que ele já pescou de cada uma.
 *
 * Só capturas não ocultas entram na conta (RGN-10; regra no dex.service).
 * Espécie desativada some do catálogo, mas continua na Dex de quem já a pescou.
 */
export async function findDexForUser(userId, { incluirInativas = false } = {}) {
  // Para o admin, a Dex lista também as espécies desativadas que ele não
  // pescou, para poder reativá-las (UC010). Isso não mexe no X/Y: o
  // dex.service só conta as ativas.
  const filtro = incluirInativas ? "" : "HAVING e.is_active = TRUE OR COUNT(c.id) > 0";
  const linhas = await query(
    `SELECT
       e.*,
       COUNT(c.id)      AS catch_count,
       MIN(c.caught_at) AS first_caught_at,
       EXISTS (
         SELECT 1 FROM user_favorite_species f
         WHERE f.user_id = ? AND f.species_id = e.id
       ) AS is_favorite
     FROM fish_species e
     LEFT JOIN catches c
       ON c.species_id = e.id AND c.user_id = ? AND c.is_hidden = FALSE
     GROUP BY e.id
     ${filtro}
     ORDER BY e.name ASC`,
    [userId, userId],
  );

  return linhas.map((linha) => ({
    ...mapSpecies(linha),
    captured: linha.catch_count > 0,
    catchCount: linha.catch_count,
    firstCaughtAt: linha.first_caught_at,
    isFavorite: Boolean(linha.is_favorite),
  }));
}
