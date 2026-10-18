import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";
import { publicUrl } from "../lib/storage.js";

// A tela sempre precisa da espécie, do pesqueiro e do autor junto da captura,
// então todo SELECT já vem com os JOINs. Os aliases evitam colisão entre as
// colunas chamadas `id` e `name`.
//
// O primeiro `?` é sempre o id de quem está vendo: entra uma vez só, na
// tabela derivada `v`, e é usado por `liked_by_me` e `author_followed_by_me`.
// Toda função daqui passa `viewerId` como primeiro parâmetro.
//
// `engagement` é a nota do feed "por engajamento" (REQ-35): curtidas +
// comentários com peso 2 — comentar dá mais trabalho que curtir.
const SELECT_COMPLETO = `
  SELECT
    c.id, c.user_id, c.species_id, c.spot_id, c.spot_name, c.region, c.weight, c.length,
    c.notes, c.latitude, c.longitude, c.is_flagged_for_review, c.is_hidden,
    c.caught_at, c.created_at, c.updated_at,
    e.id                     AS especie_id,
    e.name                   AS especie_name,
    e.scientific_name        AS especie_scientific_name,
    e.image_url              AS especie_image_url,
    e.image_thumb_url        AS especie_image_thumb_url,
    e.rarity                 AS especie_rarity,
    p.id                     AS pesqueiro_id,
    p.name                   AS pesqueiro_name,
    p.location               AS pesqueiro_location,
    p.google_place_id        AS pesqueiro_google_place_id,
    u.name                   AS autor_name,
    u.nickname               AS autor_nickname,
    u.avatar_url             AS autor_avatar_url,
    u.is_active              AS autor_is_active,
    u.share_exact_location   AS autor_share_exact_location,
    (SELECT COUNT(*) FROM likes    l WHERE l.catch_id = c.id) AS like_count,
    (SELECT COUNT(*) FROM comments m WHERE m.catch_id = c.id) AS comment_count,
    (SELECT COUNT(*) FROM likes    l WHERE l.catch_id = c.id)
      + 2 * (SELECT COUNT(*) FROM comments m WHERE m.catch_id = c.id) AS engagement,
    EXISTS (SELECT 1 FROM likes l WHERE l.catch_id = c.id AND l.user_id = v.viewer_id)
      AS liked_by_me,
    EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = v.viewer_id AND f.following_id = c.user_id)
      AS author_followed_by_me
  FROM (SELECT ? AS viewer_id) v
  CROSS JOIN catches c
  INNER JOIN users         u ON u.id = c.user_id
  INNER JOIN fish_species  e ON e.id = c.species_id
  LEFT  JOIN fishing_spots p ON p.id = c.spot_id
`;

const numeroOuNull = (valor) => (valor === null || valor === undefined ? null : Number(valor));

/**
 * `authorIsActive` e `authorSharesLocation` são de uso interno: o
 * catch.service usa os dois para decidir o que mostrar (RGN-12, RGN-13) e
 * tira ambos antes de responder.
 */
function mapCatch(linha) {
  if (!linha) return null;

  return {
    id: linha.id,
    userId: linha.user_id,
    speciesId: linha.species_id,
    spotId: linha.spot_id,
    spotName: linha.spot_name,
    region: linha.region,
    weight: linha.weight,
    length: linha.length,
    // Preenchido por anexarFotos, em ordem de `position` (a 1ª é a capa).
    photos: [],
    notes: linha.notes,
    latitude: numeroOuNull(linha.latitude),
    longitude: numeroOuNull(linha.longitude),
    isFlaggedForReview: Boolean(linha.is_flagged_for_review),
    isHidden: Boolean(linha.is_hidden),
    caughtAt: linha.caught_at,
    createdAt: linha.created_at,
    updatedAt: linha.updated_at,
    likeCount: linha.like_count,
    commentCount: linha.comment_count,
    likedByMe: Boolean(linha.liked_by_me),
    species: {
      id: linha.especie_id,
      name: linha.especie_name,
      scientificName: linha.especie_scientific_name,
      imageUrl: publicUrl(linha.especie_image_url),
      imageThumbUrl: publicUrl(linha.especie_image_thumb_url),
      rarity: linha.especie_rarity,
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
    author: {
      id: linha.user_id,
      name: linha.autor_name,
      nickname: linha.autor_nickname,
      avatarUrl: linha.autor_avatar_url,
      isFollowedByMe: Boolean(linha.author_followed_by_me),
    },
    authorIsActive: Boolean(linha.autor_is_active),
    authorSharesLocation: Boolean(linha.autor_share_exact_location),
  };
}

/** Busca as fotos de várias capturas numa query só e pendura em cada uma. */
async function anexarFotos(capturas, conn) {
  if (capturas.length === 0) return capturas;

  const ids = capturas.map((c) => c.id);
  const fotos = await query(
    `SELECT id, catch_id, url, position FROM catch_photos
     WHERE catch_id IN (${ids.map(() => "?").join(", ")})
     ORDER BY position ASC`,
    ids,
    conn,
  );

  const porCaptura = new Map(capturas.map((c) => [c.id, c]));
  for (const foto of fotos) {
    porCaptura.get(foto.catch_id).photos.push({
      id: foto.id,
      url: foto.url,
      position: foto.position,
    });
  }
  return capturas;
}

async function buscarVarias(sql, params, conn) {
  const linhas = await query(sql, params, conn);
  return anexarFotos(linhas.map(mapCatch), conn);
}

/** Qualquer captura, sem filtro de visibilidade — quem filtra é o service. */
export async function findById(viewerId, id, conn) {
  const [captura] = await buscarVarias(`${SELECT_COMPLETO} WHERE c.id = ?`, [viewerId, id], conn);
  return captura ?? null;
}

/** Busca uma captura garantindo que ela pertence ao usuário. */
export async function findByIdForUser(id, userId, conn) {
  const [captura] = await buscarVarias(
    `${SELECT_COMPLETO} WHERE c.id = ? AND c.user_id = ?`,
    [userId, id, userId],
    conn,
  );
  return captura ?? null;
}

/**
 * Histórico de um usuário. `viewerId` é quem está vendo (padrão: o próprio
 * dono); as ocultas só entram com `includeHidden`, que só o autor usa.
 */
export async function findAllByUser(userId, { viewerId = userId, includeHidden = false } = {}) {
  const filtro = includeHidden ? "" : "AND c.is_hidden = FALSE";
  return buscarVarias(
    `${SELECT_COMPLETO} WHERE c.user_id = ? ${filtro} ORDER BY c.caught_at DESC`,
    [viewerId, userId],
  );
}

/**
 * Feed: capturas mais recentes primeiro, paginadas por cursor (`before` é o
 * `createdAt` do último item da página anterior).
 *
 * RGN-12: só autores ativos e capturas não ocultas.
 */
export async function findFeed(viewerId, { onlyFollowing, onlyReported, order, before, offset, limit }) {
  // RGN-12 no feed normal. A fila de moderação (só admin, conferido no
  // service) mostra também ocultas e de conta inativa: é ali que se decide.
  const condicoes = onlyReported
    ? ["EXISTS (SELECT 1 FROM reports r WHERE r.catch_id = c.id AND r.status = 'pendente')"]
    : ["u.is_active = TRUE", "c.is_hidden = FALSE"];
  const params = [viewerId];

  if (onlyFollowing) {
    condicoes.push(
      "c.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)",
    );
    params.push(viewerId);
  }

  // Cronológico pagina por cursor (`before` = createdAt do último item): post
  // novo no topo não faz a próxima página repetir item. Engajamento muda de
  // ordem com cada curtida, então não tem cursor estável — vai por OFFSET.
  let ordenacao;
  if (order === "engagement") {
    ordenacao = "ORDER BY engagement DESC, c.created_at DESC, c.id DESC LIMIT ? OFFSET ?";
  } else {
    if (before) {
      condicoes.push("c.created_at < ?");
      params.push(before);
    }
    ordenacao = "ORDER BY c.created_at DESC, c.id DESC LIMIT ?";
  }

  // LIMIT/OFFSET vão como string: com prepared statement, o MySQL 8 recusa
  // número aqui ("Incorrect arguments to mysqld_stmt_execute").
  params.push(String(limit));
  if (order === "engagement") params.push(String(offset ?? 0));

  return buscarVarias(
    `${SELECT_COMPLETO} WHERE ${condicoes.join(" AND ")} ${ordenacao}`,
    params,
  );
}

/** Cria a captura e as fotos dela (`dados.photoUrls`, na ordem: a 1ª é a capa). */
export async function create(userId, dados, conn) {
  const id = randomUUID();

  await query(
    `INSERT INTO catches
       (id, user_id, species_id, spot_id, spot_name, region, weight, length,
        notes, latitude, longitude, is_flagged_for_review, caught_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      dados.speciesId,
      dados.spotId ?? null,
      dados.spotName ?? null,
      dados.region ?? null,
      dados.weight,
      dados.length,
      dados.notes ?? null,
      dados.latitude ?? null,
      dados.longitude ?? null,
      dados.isFlaggedForReview ?? false,
      dados.caughtAt,
    ],
    conn,
  );
  await inserirFotos(id, dados.photoUrls ?? [], conn);

  return findById(userId, id, conn);
}

async function inserirFotos(catchId, urls, conn) {
  for (const [posicao, url] of urls.entries()) {
    await query(
      "INSERT INTO catch_photos (id, catch_id, url, position) VALUES (?, ?, ?, ?)",
      [randomUUID(), catchId, url, posicao],
      conn,
    );
  }
}

/** Troca todas as fotos da captura pela lista nova, na ordem dada. */
export async function replacePhotos(catchId, urls, conn) {
  await query("DELETE FROM catch_photos WHERE catch_id = ?", [catchId], conn);
  await inserirFotos(catchId, urls, conn);
}

// Whitelist campo da API -> coluna do banco. É daqui que sai o SET da query,
// nunca do corpo da request: sem isso, um campo inventado pelo cliente entraria
// no SQL. Os valores continuam indo como `?`. As fotos não estão aqui: mudam
// por `replacePhotos`, que mexe em catch_photos.
const COLUNAS_EDITAVEIS = {
  speciesId: "species_id",
  spotId: "spot_id",
  spotName: "spot_name",
  region: "region",
  weight: "weight",
  length: "length",
  notes: "notes",
  latitude: "latitude",
  longitude: "longitude",
  isFlaggedForReview: "is_flagged_for_review",
  caughtAt: "caught_at",
};

export async function updateForUser(id, userId, dados, conn) {
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
    conn,
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

export async function setHidden(id, hidden, conn) {
  await query("UPDATE catches SET is_hidden = ? WHERE id = ?", [hidden, id], conn);
}

/**
 * Trava a linha da captura até o fim da transação. Usado ao denunciar: duas
 * denúncias simultâneas da mesma captura passam uma de cada vez pela contagem
 * do RGN-14, senão as duas poderiam contar "2" e nenhuma ocultaria.
 */
export async function lockById(id, conn) {
  return queryOne("SELECT id FROM catches WHERE id = ? FOR UPDATE", [id], conn);
}

/**
 * Estatísticas do usuário, calculadas na hora. Ocultas não contam (RGN-10).
 * `species_captured` só conta espécies ativas, igual ao numerador da Dex
 * (REQ-09): senão o perfil e a Dex mostrariam números diferentes.
 */
export async function statsForUser(userId) {
  const linha = await queryOne(
    `SELECT
       COUNT(*)                                                    AS total_catches,
       COUNT(DISTINCT CASE WHEN e.is_active THEN c.species_id END) AS species_captured,
       MAX(c.weight)                                               AS heaviest_weight,
       MAX(c.length)                                               AS longest_length,
       MAX(c.caught_at)                                            AS last_caught_at
     FROM catches c
     INNER JOIN fish_species e ON e.id = c.species_id
     WHERE c.user_id = ? AND c.is_hidden = FALSE`,
    [userId],
  );
  return {
    totalCatches: linha.total_catches,
    speciesCaptured: linha.species_captured,
    heaviestWeight: linha.heaviest_weight,
    longestLength: linha.longest_length,
    lastCaughtAt: linha.last_caught_at,
  };
}
