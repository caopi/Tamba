// Tabelas da parte social que são só ligação entre duas outras: follows,
// likes e user_favorite_species. Nenhuma tem id próprio — a chave primária é
// o par, e é ela que impede duplicata (RGN-15).
//
// Os INSERTs não conferem duplicata antes: deixam a PK recusar e o service
// trata o ER_DUP_ENTRY como "já existia" (ver isDuplicateKey em lib/db.js).
// Assim não existe janela entre "conferir" e "inserir".

import { query, queryOne } from "../lib/db.js";
import { mapPublicUser } from "./user.model.js";
import { mapSpecies } from "./species.model.js";

// --- follows ---

export async function createFollow(followerId, followingId, conn) {
  await query(
    "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
    [followerId, followingId],
    conn,
  );
}

export async function deleteFollow(followerId, followingId) {
  const resultado = await query(
    "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
  );
  return resultado.affectedRows;
}

export async function isFollowing(followerId, followingId) {
  const linha = await queryOne(
    "SELECT 1 AS ok FROM follows WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
  );
  return linha !== null;
}

/** Contagens só com contas ativas, igual ao que as listas mostram. */
export async function countFollows(userId) {
  const linha = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM follows f JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ? AND u.is_active = TRUE) AS followers,
       (SELECT COUNT(*) FROM follows f JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ? AND u.is_active = TRUE) AS following`,
    [userId, userId],
  );
  return { followers: linha.followers, following: linha.following };
}

export async function listFollowers(userId) {
  const linhas = await query(
    `SELECT u.* FROM follows f
     JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ? AND u.is_active = TRUE
     ORDER BY f.created_at DESC`,
    [userId],
  );
  return linhas.map(mapPublicUser);
}

export async function listFollowing(userId) {
  const linhas = await query(
    `SELECT u.* FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ? AND u.is_active = TRUE
     ORDER BY f.created_at DESC`,
    [userId],
  );
  return linhas.map(mapPublicUser);
}

// --- likes ---

export async function createLike(userId, catchId, conn) {
  await query("INSERT INTO likes (user_id, catch_id) VALUES (?, ?)", [userId, catchId], conn);
}

export async function deleteLike(userId, catchId) {
  const resultado = await query("DELETE FROM likes WHERE user_id = ? AND catch_id = ?", [
    userId,
    catchId,
  ]);
  return resultado.affectedRows;
}

/** Estado da curtida depois de um toggle: se o usuário curte e o total. */
export async function likeState(userId, catchId) {
  const linha = await queryOne(
    `SELECT
       EXISTS (SELECT 1 FROM likes WHERE user_id = ? AND catch_id = ?) AS liked,
       (SELECT COUNT(*) FROM likes WHERE catch_id = ?)                 AS like_count`,
    [userId, catchId, catchId],
  );
  return { liked: Boolean(linha.liked), likeCount: linha.like_count };
}

// --- favoritos ---

export async function createFavorite(userId, speciesId) {
  await query("INSERT INTO user_favorite_species (user_id, species_id) VALUES (?, ?)", [
    userId,
    speciesId,
  ]);
}

export async function deleteFavorite(userId, speciesId) {
  const resultado = await query(
    "DELETE FROM user_favorite_species WHERE user_id = ? AND species_id = ?",
    [userId, speciesId],
  );
  return resultado.affectedRows;
}

export async function listFavorites(userId) {
  const linhas = await query(
    `SELECT e.* FROM user_favorite_species f
     JOIN fish_species e ON e.id = f.species_id
     WHERE f.user_id = ?
     ORDER BY e.name ASC`,
    [userId],
  );
  return linhas.map(mapSpecies);
}
