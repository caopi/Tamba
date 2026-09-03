import { query, queryOne } from "../lib/db.js";

export function mapSpecies(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.name,
    scientificName: linha.scientific_name,
    habitat: linha.habitat,
    imageUrl: linha.image_url,
    recommendedBaits: linha.recommended_baits,
  };
}

export async function findAll() {
  const linhas = await query("SELECT * FROM fish_species ORDER BY name ASC");
  return linhas.map(mapSpecies);
}

export async function findById(id) {
  return mapSpecies(await queryOne("SELECT * FROM fish_species WHERE id = ?", [id]));
}

/** Só checa existência, sem trazer a linha inteira. Usado ao criar captura. */
export async function exists(id) {
  return (await queryOne("SELECT id FROM fish_species WHERE id = ?", [id])) !== null;
}
