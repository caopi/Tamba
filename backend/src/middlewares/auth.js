import { verifyToken } from "../lib/jwt.js";
import * as userModel from "../models/user.model.js";

/**
 * Protege rotas privadas. Espera o header `Authorization: Bearer <token>`,
 * coloca o id do usuário logado em `req.userId` e `{ id, role }` em `req.user`.
 *
 * Papel e situação da conta vêm do banco a cada request, não do token: o JWT
 * dura 7 dias, e sem isso um admin rebaixado ou uma conta desativada
 * continuariam valendo até o token expirar (RGN-04).
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  try {
    const acesso = await userModel.findAccess(payload.sub);
    if (!acesso || !acesso.isActive) {
      return res.status(401).json({ error: "Sessão inválida. Entre novamente." });
    }
    req.userId = acesso.id;
    req.user = { id: acesso.id, role: acesso.role };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Só admin passa. Vai sempre depois do `requireAuth`. O service confere de
 * novo com `assertAdmin` (lib/authz.js) — este middleware só barra mais cedo.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem fazer isso" });
  }
  next();
}
