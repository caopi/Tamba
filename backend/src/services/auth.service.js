// Cadastro, confirmação de e-mail e login (RGN-01 a RGN-05).

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import * as userModel from "../models/user.model.js";
import { isDuplicateKey } from "../lib/db.js";
import { signToken } from "../lib/jwt.js";
import { sendVerificationEmail } from "../lib/mailer.js";
import { httpError } from "../middlewares/errorHandler.js";

const VALIDADE_LINK_MS = 24 * 60 * 60 * 1000;

// Para onde o link do e-mail aponta. O token vai na query string.
const URL_CONFIRMACAO =
  process.env.EMAIL_VERIFICATION_URL ?? "http://localhost:3333/api/auth/verify-email";

// Apelido aparece em URL de perfil e em menção, por isso o formato restrito.
export const nicknameSchema = z
  .string()
  .trim()
  .min(3, "O apelido precisa de no mínimo 3 caracteres")
  .max(30, "O apelido pode ter no máximo 30 caracteres")
  .regex(/^[a-zA-Z0-9_.]+$/, "Use só letras, números, ponto e sublinhado no apelido");

const signupSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  // RGN-02: apelido obrigatório e único (o único é conferido em `signup`).
  nickname: nicknameSchema,
  // RGN-01: e-mail válido e único (o único é conferido em `signup`).
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(191),
  // RGN-03: senha com no mínimo 8 caracteres.
  password: z.string().min(8, "A senha precisa de no mínimo 8 caracteres"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

function novoTokenDeConfirmacao() {
  return {
    token: randomBytes(32).toString("hex"), // 64 caracteres, cabe no VARCHAR(64)
    expiresAt: new Date(Date.now() + VALIDADE_LINK_MS),
  };
}

function linkDeConfirmacao(token) {
  return `${URL_CONFIRMACAO}?token=${token}`;
}

/**
 * RGN-01: cria a conta INATIVA e manda o link de confirmação. Não devolve
 * token de acesso: só dá para entrar depois de confirmar o e-mail (RGN-04).
 */
export async function signup(entrada) {
  const dados = signupSchema.parse(entrada);

  // RGN-01 (e-mail) e RGN-02 (apelido) únicos. Conferir antes dá a mensagem
  // certa; o UNIQUE do banco cobre a corrida entre dois cadastros simultâneos.
  if (await userModel.findByEmail(dados.email)) {
    throw httpError(409, "Já existe uma conta com esse e-mail");
  }
  if (await userModel.nicknameTaken(dados.nickname)) {
    throw httpError(409, "Esse apelido já está em uso");
  }

  const { token, expiresAt } = novoTokenDeConfirmacao();
  let user;
  try {
    user = await userModel.create({
      name: dados.name,
      nickname: dados.nickname,
      email: dados.email,
      passwordHash: await bcrypt.hash(dados.password, 10),
      verificationToken: token,
      verificationExpiresAt: expiresAt,
    });
  } catch (err) {
    if (isDuplicateKey(err, "uk_users_email")) {
      throw httpError(409, "Já existe uma conta com esse e-mail");
    }
    if (isDuplicateKey(err, "uk_users_nickname")) {
      throw httpError(409, "Esse apelido já está em uso");
    }
    throw err;
  }

  await sendVerificationEmail(user.email, linkDeConfirmacao(token));
  return user;
}

/**
 * RGN-01: a conta só fica ativa depois de abrir o link do e-mail.
 *
 * Devolve o resultado em vez de lançar erro — 'ok', 'expired' ou 'invalid'
 * (token inexistente ou já usado) — porque quem chama é um link clicado no
 * e-mail: a rota redireciona para a tela do frontend com esse status.
 */
export async function verifyEmail(token) {
  if (typeof token !== "string" || token === "") return "invalid";

  const linha = await userModel.findByVerificationToken(token);
  if (!linha) return "invalid";
  if (linha.email_verification_expires_at < new Date()) return "expired";

  await userModel.activate(linha.id);
  return "ok";
}

/**
 * Gera um link novo (o anterior para de valer). Não diz se o e-mail existe
 * nem se a conta já está ativa: a resposta é sempre a mesma, para a rota não
 * servir de consulta de e-mails cadastrados.
 */
export async function resendVerification(entrada) {
  const { email } = emailSchema.parse(entrada);

  const linha = await userModel.findByEmail(email);
  if (!linha || linha.is_active) return;

  const { token, expiresAt } = novoTokenDeConfirmacao();
  await userModel.setVerificationToken(linha.id, token, expiresAt);
  await sendVerificationEmail(linha.email, linkDeConfirmacao(token));
}

export async function login(entrada) {
  const { email, password } = loginSchema.parse(entrada);

  const linha = await userModel.findByEmail(email);
  // RGN-05: credencial inválida barra a entrada. Mensagem genérica de
  // propósito: não revela se o e-mail existe.
  const senhaOk = linha && (await bcrypt.compare(password, linha.password_hash));
  if (!senhaOk) throw httpError(401, "E-mail ou senha incorretos");

  // RGN-04: só usuário ativo entra. Conferido depois da senha, para que só
  // quem sabe a senha descubra que a conta existe e está pendente.
  if (!linha.is_active) {
    throw httpError(403, "Confirme seu e-mail antes de entrar", { code: "EMAIL_NOT_VERIFIED" });
  }

  return { user: userModel.mapUser(linha), token: signToken(linha.id) };
}
