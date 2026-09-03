import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não definido no .env");
}

/** Gera o access token do usuário (único token do app, sem refresh). */
export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** Valida o token e devolve o payload. Lança erro se inválido/expirado. */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
