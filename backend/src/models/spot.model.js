import { query, queryOne } from "../lib/db.js";

export function mapSpot(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.name,
    location: linha.location,
    googlePlaceId: linha.google_place_id,
  };
}

export async function findAll() {
  const linhas = await query("SELECT * FROM fishing_spots ORDER BY name ASC");
  return linhas.map(mapSpot);
}

export async function findById(id) {
  return mapSpot(await queryOne("SELECT * FROM fishing_spots WHERE id = ?", [id]));
}

export async function exists(id) {
  return (await queryOne("SELECT id FROM fishing_spots WHERE id = ?", [id])) !== null;
}
