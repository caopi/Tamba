import bcrypt from "bcryptjs";
import { z } from "zod";
import * as userModel from "../models/user.model.js";
import { signToken } from "../lib/jwt.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { httpError } from "../middlewares/errorHandler.js";

const signupSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa de no mínimo 6 caracteres"),
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

// POST /api/auth/signup
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = signupSchema.parse(req.body);

  if (await userModel.findByEmail(email)) {
    throw httpError(409, "Já existe uma conta com esse e-mail");
  }

  const user = await userModel.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
  });

  res.status(201).json({ user, token: signToken(user.id) });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const linha = await userModel.findByEmail(email);
  // Mensagem genérica de propósito: não revela se o e-mail existe.
  const senhaOk = linha && (await bcrypt.compare(password, linha.password_hash));
  if (!senhaOk) throw httpError(401, "E-mail ou senha incorretos");

  res.json({ user: userModel.mapUser(linha), token: signToken(linha.id) });
});

// GET /api/auth/me  (privada)
export const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.userId);
  if (!user) throw httpError(404, "Usuário não encontrado");
  res.json(user);
});
