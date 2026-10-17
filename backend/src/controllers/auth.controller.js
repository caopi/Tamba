import * as authService from "../services/auth.service.js";
import * as userService from "../services/user.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// POST /api/auth/signup  -> { user, token, requiresVerification, message }
// Com REQUIRE_EMAIL_VERIFICATION=true a conta nasce inativa e `token` vem
// null (o login só depois de confirmar); senão já vem logada.
export const signup = asyncHandler(async (req, res) => {
  const resultado = await authService.signup(req.body);
  res.status(201).json({
    ...resultado,
    message: resultado.requiresVerification
      ? "Conta criada. Enviamos um link de confirmação para o seu e-mail."
      : "Conta criada.",
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body));
});

// GET /api/auth/me  (privada)
export const me = asyncHandler(async (req, res) => {
  res.json(await userService.getMe(req.userId));
});

// GET /api/auth/verify-email?token=...  -> é o link que vai no e-mail.
// Com FRONTEND_URL, redireciona para a tela de resultado do frontend; sem ela
// (API rodando sozinha), responde JSON com o mesmo status.
const STATUS_HTTP = { ok: 200, expired: 410, invalid: 400 };

export const verifyEmail = asyncHandler(async (req, res) => {
  const status = await authService.verifyEmail(req.query.token);

  const frontend = process.env.FRONTEND_URL;
  if (frontend) {
    return res.redirect(302, `${frontend.replace(/\/+$/, "")}/verificacao?status=${status}`);
  }
  res.status(STATUS_HTTP[status]).json({ status });
});

// POST /api/auth/resend-verification  { email }
export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.body);
  // Mesma resposta exista o e-mail ou não (ver o service).
  res.status(202).json({
    message: "Se houver uma conta pendente com esse e-mail, enviamos um novo link.",
  });
});
