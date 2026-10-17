// Perfil próprio (preferências) e perfil público de outros usuários.

import { z } from "zod";
import * as userModel from "../models/user.model.js";
import * as catchModel from "../models/catch.model.js";
import * as socialModel from "../models/social.model.js";
import { isDuplicateKey } from "../lib/db.js";
import { httpError } from "../middlewares/errorHandler.js";
import { nicknameSchema } from "./auth.service.js";

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
    // RGN-02: apelido continua único ao ser trocado.
    nickname: nicknameSchema,
    avatarUrl: z.string().trim().url("URL do avatar inválida").nullable(),
    // Só preferência de exibição: o banco grava peso sempre em kg.
    measurementUnit: z.enum(["kg", "lb"]),
    // RGN-13: quem decide se a coordenada exata aparece para os outros.
    shareExactLocation: z.boolean(),
  })
  .partial();

export async function getMe(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw httpError(404, "Usuário não encontrado");
  return user;
}

/**
 * RGN-06: só o usuário autenticado edita os próprios dados. Não existe rota
 * nem parâmetro para escolher QUEM editar: o `userId` sai sempre do token
 * (req.userId, posto pelo requireAuth) e vai no WHERE do UPDATE. E-mail,
 * senha e papel nem estão na whitelist do model.
 */
export async function updateMe(userId, entrada) {
  const dados = updateMeSchema.parse(entrada);

  if (dados.nickname && (await userModel.nicknameTaken(dados.nickname, userId))) {
    throw httpError(409, "Esse apelido já está em uso");
  }

  try {
    await userModel.update(userId, dados);
  } catch (err) {
    if (isDuplicateKey(err, "uk_users_nickname")) {
      throw httpError(409, "Esse apelido já está em uso");
    }
    throw err;
  }
  return getMe(userId);
}

/** Perfil de outro usuário. Conta inativa é tratada como inexistente (RGN-12). */
export async function getPublicProfile(viewerId, userId) {
  const user = await userModel.findActivePublicById(userId);
  if (!user) throw httpError(404, "Usuário não encontrado");

  const [contagens, stats, seguindo] = await Promise.all([
    socialModel.countFollows(userId),
    catchModel.statsForUser(userId),
    viewerId === userId ? false : socialModel.isFollowing(viewerId, userId),
  ]);

  return { ...user, ...contagens, stats, isFollowedByMe: seguindo };
}
