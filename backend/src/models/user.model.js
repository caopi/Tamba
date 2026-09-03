import { randomUUID } from "node:crypto";
import { query, queryOne } from "../lib/db.js";

/** Converte a linha do banco (snake_case) no formato que a API expõe (camelCase). */
function mapUser(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.name,
    email: linha.email,
    createdAt: linha.created_at,
  };
}

/** Busca por e-mail. Traz o password_hash porque o login precisa comparar. */
export async function findByEmail(email) {
  return queryOne("SELECT * FROM users WHERE email = ?", [email]);
}

/** Busca por id, já no formato público (sem o hash da senha). */
export async function findById(id) {
  const linha = await queryOne(
    "SELECT id, name, email, created_at FROM users WHERE id = ?",
    [id],
  );
  return mapUser(linha);
}

export async function create({ name, email, passwordHash }) {
  const id = randomUUID();
  await query(
    "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
    [id, email, passwordHash, name],
  );
  return findById(id);
}

export { mapUser };
