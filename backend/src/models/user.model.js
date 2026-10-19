import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";

/**
 * O que o próprio usuário vê de si mesmo (camelCase, sem hash nem token).
 * Para mostrar alguém a outra pessoa, use `mapPublicUser`.
 */
function mapUser(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.name,
    nickname: linha.nickname,
    email: linha.email,
    avatarUrl: linha.avatar_url,
    role: linha.role,
    measurementUnit: linha.measurement_unit,
    feedOrder: linha.feed_order,
    shareExactLocation: Boolean(linha.share_exact_location),
    notifyLikes: Boolean(linha.notify_likes),
    notifyComments: Boolean(linha.notify_comments),
    notifyFollows: Boolean(linha.notify_follows),
    createdAt: linha.created_at,
  };
}

/** O que os outros usuários veem: sem e-mail, papel nem preferências. */
function mapPublicUser(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.name,
    nickname: linha.nickname,
    avatarUrl: linha.avatar_url,
    createdAt: linha.created_at,
  };
}

const COLUNAS_PROPRIAS = `id, name, nickname, email, avatar_url, role, measurement_unit, feed_order,
  share_exact_location, notify_likes, notify_comments, notify_follows, created_at`;

/** Busca por e-mail. Traz a linha inteira porque o login compara o hash. */
export async function findByEmail(email) {
  return queryOne("SELECT * FROM users WHERE email = ?", [email]);
}

/** Busca por id, já no formato do próprio usuário (sem o hash da senha). */
export async function findById(id) {
  return mapUser(await queryOne(`SELECT ${COLUNAS_PROPRIAS} FROM users WHERE id = ?`, [id]));
}

/** Só papel e situação da conta: o que o middleware precisa a cada request. */
export async function findAccess(id) {
  const linha = await queryOne("SELECT id, role, is_active FROM users WHERE id = ?", [id]);
  return linha && { id: linha.id, role: linha.role, isActive: Boolean(linha.is_active) };
}

/** Usuário no formato público, só se a conta estiver ativa. */
export async function findActivePublicById(id) {
  return mapPublicUser(
    await queryOne("SELECT * FROM users WHERE id = ? AND is_active = TRUE", [id]),
  );
}

/**
 * Perfil público mesmo de conta inativa, com `isActive` junto. Só para o
 * admin, que precisa abrir o perfil de quem desativou para poder reativar.
 */
export async function findPublicByIdForAdmin(id) {
  const linha = await queryOne("SELECT * FROM users WHERE id = ?", [id]);
  return linha && { ...mapPublicUser(linha), isActive: Boolean(linha.is_active), role: linha.role };
}

/**
 * Desativação/reativação pelo admin (UC002, lado admin). Desativar também
 * apaga o token de confirmação pendente: assim "inativa SEM token" passa a
 * significar sempre "desativada por admin", e "inativa COM token" sempre
 * "cadastro esperando confirmar o e-mail" — é essa diferença que o login e o
 * reenvio do link usam (auth.service). Sem coluna nova de status.
 */
export async function setActiveByAdmin(id, ativo) {
  await query(
    ativo
      ? "UPDATE users SET is_active = TRUE WHERE id = ?"
      : `UPDATE users
         SET is_active = FALSE, email_verification_token = NULL, email_verification_expires_at = NULL
         WHERE id = ?`,
    [id],
  );
}

// Colunas de um "cartão de pessoa" (busca e sugestões): perfil público +
// contagens + se quem está vendo já segue. O `?` é o id de quem está vendo.
const SELECT_CARTAO = `
  SELECT u.id, u.name, u.nickname, u.avatar_url, u.created_at,
    (SELECT COUNT(*) FROM follows f JOIN users s ON s.id = f.follower_id
      WHERE f.following_id = u.id AND s.is_active = TRUE) AS followers,
    (SELECT COUNT(*) FROM catches c WHERE c.user_id = u.id AND c.is_hidden = FALSE) AS catch_count,
    (SELECT MAX(c.created_at) FROM catches c WHERE c.user_id = u.id AND c.is_hidden = FALSE)
      AS last_catch_at,
    EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = v.viewer_id AND f.following_id = u.id)
      AS followed_by_me
  FROM (SELECT ? AS viewer_id) v
  CROSS JOIN users u
`;

function mapCartao(linha) {
  return {
    ...mapPublicUser(linha),
    followers: linha.followers,
    catchCount: linha.catch_count,
    lastCatchAt: linha.last_catch_at,
    isFollowedByMe: Boolean(linha.followed_by_me),
  };
}

/**
 * Busca por nome ou apelido (REQ-41/42). A collation da tabela ignora caixa
 * e acento: "joao" acha "João". `%` e `_` digitados são escapados para valer
 * como texto, não como curinga do LIKE.
 */
export async function search(viewerId, termo, limit) {
  const padrao = `%${termo.replace(/[\\%_]/g, "\\$&")}%`;
  const linhas = await query(
    `${SELECT_CARTAO}
     WHERE u.is_active = TRUE AND (u.name LIKE ? OR u.nickname LIKE ?)
     ORDER BY (u.nickname LIKE ?) DESC, followers DESC, u.nickname ASC
     LIMIT ?`,
    // O 3º padrão põe primeiro quem tem o APELIDO começando pelo termo.
    [viewerId, padrao, padrao, `${termo.replace(/[\\%_]/g, "\\$&")}%`, String(limit)],
  );
  return linhas.map(mapCartao);
}

/**
 * Sugestões de quem seguir (REQ-36): os mais seguidos, desempatando por quem
 * postou mais recentemente. Só entra quem tem pelo menos uma captura visível —
 * seguir um perfil vazio não resolveria o feed vazio. Fora quem o usuário já
 * segue e ele mesmo.
 */
export async function suggestions(viewerId, limit) {
  const linhas = await query(
    `${SELECT_CARTAO}
     WHERE u.is_active = TRUE
       AND u.id <> v.viewer_id
       AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = v.viewer_id AND f.following_id = u.id)
       AND EXISTS (SELECT 1 FROM catches c WHERE c.user_id = u.id AND c.is_hidden = FALSE)
     ORDER BY followers DESC, last_catch_at DESC
     LIMIT ?`,
    [viewerId, String(limit)],
  );
  return linhas.map(mapCartao);
}

/** `exceptId` deixa o próprio usuário "reusar" o apelido que já é dele. */
export async function nicknameTaken(nickname, exceptId = null) {
  const linha = await queryOne(
    "SELECT id FROM users WHERE nickname = ? AND (? IS NULL OR id <> ?)",
    [nickname, exceptId, exceptId],
  );
  return linha !== null;
}

export async function create({
  name,
  nickname,
  email,
  passwordHash,
  isActive = false,
  role = "user",
  verificationToken,
  verificationExpiresAt,
}) {
  const id = randomUUID();
  await query(
    `INSERT INTO users
       (id, email, password_hash, name, nickname, is_active, role,
        email_verification_token, email_verification_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      email,
      passwordHash,
      name,
      nickname ?? null,
      isActive,
      role,
      verificationToken ?? null,
      verificationExpiresAt ?? null,
    ],
  );
  return findById(id);
}

export async function findByVerificationToken(token) {
  return queryOne("SELECT * FROM users WHERE email_verification_token = ?", [token]);
}

/** Ativa a conta e invalida o token (o link só funciona uma vez). */
export async function activate(id) {
  await query(
    `UPDATE users
     SET is_active = TRUE, email_verification_token = NULL, email_verification_expires_at = NULL
     WHERE id = ?`,
    [id],
  );
}

/** Gera um link novo: o token anterior é sobrescrito e deixa de valer. */
export async function setVerificationToken(id, token, expiresAt) {
  await query(
    "UPDATE users SET email_verification_token = ?, email_verification_expires_at = ? WHERE id = ?",
    [token, expiresAt, id],
  );
}

// Mesma ideia da whitelist de catch.model.js: o SET sai daqui, nunca da request.
const COLUNAS_EDITAVEIS = {
  name: "name",
  nickname: "nickname",
  avatarUrl: "avatar_url",
  measurementUnit: "measurement_unit",
  feedOrder: "feed_order",
  shareExactLocation: "share_exact_location",
  notifyLikes: "notify_likes",
  notifyComments: "notify_comments",
  notifyFollows: "notify_follows",
};

export async function update(id, dados) {
  const atribuicoes = [];
  const valores = [];

  for (const [campo, coluna] of Object.entries(COLUNAS_EDITAVEIS)) {
    if (campo in dados) {
      atribuicoes.push(`${coluna} = ?`);
      valores.push(dados[campo] ?? null);
    }
  }
  if (atribuicoes.length === 0) return;

  valores.push(id);
  await query(`UPDATE users SET ${atribuicoes.join(", ")} WHERE id = ?`, valores);
}

export { mapUser, mapPublicUser };
