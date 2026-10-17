import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";

// A tela sempre precisa da espécie e do pesqueiro junto da captura, então todo
// SELECT já vem com os JOINs. Os aliases evitam colisão entre as três colunas
// chamadas `id` e as duas chamadas `name`.
const SELECT_COMPLETO = `
  SELECT
    c.id, c.user_id, c.species_id, c.spot_id, c.spot_name, c.weight, c.length,
    c.photo_url, c.caught_at, c.created_at,
    e.id                AS especie_id,
    e.name              AS especie_name,
    e.scientific_name   AS especie_scientific_name,
    e.habitat           AS especie_habitat,
    e.image_url         AS especie_image_url,
    e.recommended_baits AS especie_recommended_baits,
    p.id                AS pesqueiro_id,
    p.name              AS pesqueiro_name,
    p.location          AS pesqueiro_location,
    p.google_place_id   AS pesqueiro_google_place_id
  FROM catches c
  INNER JOIN fish_species  e ON e.id = c.species_id
  LEFT  JOIN fishing_spots p ON p.id = c.spot_id
`;

function mapCatch(linha) {
  if (!linha) return null;

  return {
    id: linha.id,
    userId: linha.user_id,
    speciesId: linha.species_id,
    spotId: linha.spot_id,
    spotName: linha.spot_name,
    weight: linha.weight,
    length: linha.length,
    photoUrl: linha.photo_url,
    caughtAt: linha.caught_at,
    createdAt: linha.created_at,
    species: {
      id: linha.especie_id,
      name: linha.especie_name,
      scientificName: linha.especie_scientific_name,
      habitat: linha.especie_habitat,
      imageUrl: linha.especie_image_url,
      recommendedBaits: linha.especie_recommended_baits,
    },
    // LEFT JOIN: sem pesqueiro, todas as colunas vêm nulas.
    spot: linha.pesqueiro_id
      ? {
          id: linha.pesqueiro_id,
          name: linha.pesqueiro_name,
          location: linha.pesqueiro_location,
          googlePlaceId: linha.pesqueiro_google_place_id,
        }
      : null,
  };
}

export async function findAllByUser(userId) {
  const linhas = await query(
    `${SELECT_COMPLETO} WHERE c.user_id = ? ORDER BY c.caught_at DESC`,
    [userId],
  );
  return linhas.map(mapCatch);
}

/** Busca uma captura garantindo que ela pertence ao usuário. */
export async function findByIdForUser(id, userId) {
  return mapCatch(
    await queryOne(`${SELECT_COMPLETO} WHERE c.id = ? AND c.user_id = ?`, [id, userId]),
  );
}

export async function create(userId, dados) {
  const id = randomUUID();

  await query(
    `INSERT INTO catches
       (id, user_id, species_id, spot_id, spot_name, weight, length, photo_url, caught_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      dados.speciesId,
      dados.spotId ?? null,
      dados.spotName ?? null,
      dados.weight,
      dados.length,
      dados.photoUrl ?? null,
      dados.caughtAt,
    ],
  );

  return findByIdForUser(id, userId);
}

// Whitelist campo da API -> coluna do banco. É daqui que sai o SET da query,
// nunca do corpo da request: sem isso, um campo inventado pelo cliente entraria
// no SQL. Os valores continuam indo como `?`.
const COLUNAS_EDITAVEIS = {
  speciesId: "species_id",
  spotId: "spot_id",
  spotName: "spot_name",
  weight: "weight",
  length: "length",
  photoUrl: "photo_url",
  caughtAt: "caught_at",
};

export async function updateForUser(id, userId, dados) {
  const atribuicoes = [];
  const valores = [];

  for (const [campo, coluna] of Object.entries(COLUNAS_EDITAVEIS)) {
    if (campo in dados) {
      atribuicoes.push(`${coluna} = ?`);
      valores.push(dados[campo] ?? null);
    }
  }

  // PUT sem nenhum campo conhecido: não há o que atualizar.
  if (atribuicoes.length === 0) return;

  valores.push(id, userId);
  await query(
    `UPDATE catches SET ${atribuicoes.join(", ")} WHERE id = ? AND user_id = ?`,
    valores,
  );
}

/** Devolve quantas linhas foram apagadas (0 = não era do usuário ou não existe). */
export async function deleteForUser(id, userId) {
  const resultado = await query("DELETE FROM catches WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  return resultado.affectedRows;
}
