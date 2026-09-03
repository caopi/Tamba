import { verifyToken } from "../lib/jwt.js";

/**
 * Protege rotas privadas. Espera o header `Authorization: Bearer <token>`
 * e coloca o id do usuário logado em `req.userId`.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
