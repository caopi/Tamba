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
    shareExactLocation: Boolean(linha.share_exact_location),
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

const COLUNAS_PROPRIAS = `id, name, nickname, email, avatar_url, role, measurement_unit,
  share_exact_location, created_at`;

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
  shareExactLocation: "share_exact_location",
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
