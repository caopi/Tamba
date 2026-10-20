// Perfil próprio (preferências) e perfil público de outros usuários.

import { z } from "zod";
import * as userModel from "../models/user.model.js";
import * as catchModel from "../models/catch.model.js";
import * as socialModel from "../models/social.model.js";
import { isDuplicateKey } from "../lib/db.js";
import { httpError } from "../middlewares/errorHandler.js";
import { nicknameSchema } from "./auth.service.js";
import { ownedKey } from "../lib/storage.js";
import { assertAdmin } from "../lib/authz.js";

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
    // RGN-02: apelido continua único ao ser trocado.
    nickname: nicknameSchema,
    // Foto enviada pelo POST /api/uploads do próprio usuário (conferido em
    // updateMe); null remove o avatar.
    avatarUrl: z.string().trim().url("URL do avatar inválida").nullable(),
    // Só preferência de exibição: o banco grava sempre em kg e cm. "kg" é o
    // sistema métrico (kg, cm); "lb" é o imperial (libras e polegadas). Quem
    // converte é o frontend.
    measurementUnit: z.enum(["kg", "lb"]),
    // Ordem padrão do feed (o seletor saiu do feed e mora nas Configurações).
    feedOrder: z.enum(["engagement", "recent"]),
    // RGN-13: quem decide se a coordenada exata aparece para os outros.
    shareExactLocation: z.boolean(),
    // Preferências de notificação (UC007): tipo desligado não é gravado.
    notifyLikes: z.boolean(),
    notifyComments: z.boolean(),
    notifyFollows: z.boolean(),
  })
  .partial();

const activeSchema = z.object({
  isActive: z.boolean({ required_error: "Informe isActive (true ou false)" }),
});

const searchSchema = z.object({
  q: z.string().trim().min(2, "Digite pelo menos 2 letras para buscar").max(60),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** REQ-41/42: busca usuários por nome ou apelido. */
export async function searchUsers(viewerId, entrada) {
  const { q, limit } = searchSchema.parse(entrada);
  return userModel.search(viewerId, q, limit);
}

/** REQ-36: sugestões de quem seguir, para o feed vazio e a tela de busca. */
export async function suggestUsers(viewerId) {
  return userModel.suggestions(viewerId, 6);
}

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

  // Avatar só de foto que o próprio usuário enviou (mesma regra das fotos de
  // captura): não dá para usar link externo nem a foto de outra pessoa.
  // O banco guarda a chave, não a URL (ver lib/storage.js).
  if (dados.avatarUrl) {
    const chave = ownedKey(dados.avatarUrl, userId);
    if (!chave) throw httpError(422, "Use uma foto enviada por você pelo app", { code: "PHOTO_NOT_OWNED" });
    dados.avatarUrl = chave;
  }

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

/**
 * Perfil de outro usuário. `viewer` é `{ id, role }` de quem está vendo.
 *
 * Conta inativa é tratada como inexistente (RGN-12) — menos para o admin,
 * que precisa abrir o perfil de quem desativou para poder reativar; para ele
 * a resposta traz também `isActive` e `role`.
 */
export async function getPublicProfile(viewer, userId) {
  const ehAdmin = viewer.role === "admin";
  const user = ehAdmin
    ? await userModel.findPublicByIdForAdmin(userId)
    : await userModel.findActivePublicById(userId);
  if (!user) throw httpError(404, "Usuário não encontrado");

  const [contagens, stats, seguindo] = await Promise.all([
    socialModel.countFollows(userId),
    catchModel.statsForUser(userId),
    viewer.id === userId ? false : socialModel.isFollowing(viewer.id, userId),
  ]);

  return { ...user, ...contagens, stats, isFollowedByMe: seguindo };
}

/**
 * UC002, lado admin: desativar ou reativar uma conta.
 *
 * Desativar é o "banimento" deste projeto, de propósito simples: sem motivo,
 * sem prazo, sem histórico (ver ARQUITETURA). O efeito vem do que já existe:
 * conta inativa some do feed e das buscas (RGN-12), toda request dela é
 * recusada no requireAuth, e o login não a reativa (auth.service). O admin
 * não pode desativar a si mesmo — ficaria trancado para fora.
 */
export async function setUserActive(actor, userId, entrada) {
  assertAdmin(actor);
  const { isActive } = activeSchema.parse(entrada);
  if (actor.id === userId) {
    throw httpError(422, "Você não pode desativar a sua própria conta");
  }
  if (!(await userModel.findPublicByIdForAdmin(userId))) {
    throw httpError(404, "Usuário não encontrado");
  }
  await userModel.setActiveByAdmin(userId, isActive);
  return getPublicProfile(actor, userId);
}
