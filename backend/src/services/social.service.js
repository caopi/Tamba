// Seguir, curtir e comentar (RGN-15), com as notificações que cada um gera.
//
// Curtir e comentar só funcionam em captura que o usuário consegue ver
// (RGN-12, via findVisibleCatch). Ninguém é notificado das próprias ações.
//
// Seguir e curtir são idempotentes: são botões de liga/desliga, e um toque
// duplo não pode virar mensagem de erro. "Ligar" garante que a linha existe,
// "desligar" garante que não existe, e os dois devolvem o estado final. O
// RGN-15 (um follow/uma curtida por par) continua garantido pela chave
// primária das tabelas: o segundo INSERT é recusado pelo banco, e aqui só
// tratamos essa recusa como "já estava ligado".

import { z } from "zod";
import * as socialModel from "../models/social.model.js";
import * as commentModel from "../models/comment.model.js";
import * as notificationModel from "../models/notification.model.js";
import * as userModel from "../models/user.model.js";
import { isDuplicateKey, withTransaction } from "../lib/db.js";
import { httpError } from "../middlewares/errorHandler.js";
import { findVisibleCatch } from "./catch.service.js";

const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "O comentário não pode ficar vazio")
    .max(1000, "Comentário muito longo"),
});

async function usuarioAtivo(userId) {
  const user = await userModel.findActivePublicById(userId);
  if (!user) throw httpError(404, "Usuário não encontrado");
  return user;
}

/**
 * Roda o INSERT de um par. Devolve true se a linha é nova e false se a PK
 * recusou por já existir (RGN-15). Dentro de transação isso é seguro: no
 * InnoDB, o erro de chave duplicada desfaz só o comando, não a transação.
 */
async function inserirSeNovo(inserir) {
  try {
    await inserir();
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

// --- follows ---

async function estadoDoFollow(followerId, followingId) {
  const [seguindo, contagens] = await Promise.all([
    socialModel.isFollowing(followerId, followingId),
    socialModel.countFollows(followingId),
  ]);
  return { following: seguindo, followers: contagens.followers };
}

/** Garante que `followerId` segue `followingId`. Devolve o estado final. */
export async function follow(followerId, followingId) {
  // RGN-15: ninguém segue a si mesmo. Aqui é erro de verdade (422), não toque
  // duplo. Os triggers da migration 007 barram no banco também; conferir
  // aqui é o que dá a mensagem amigável.
  if (followerId === followingId) {
    throw httpError(422, "Você não pode seguir a si mesmo");
  }
  await usuarioAtivo(followingId);

  await withTransaction(async (conn) => {
    const novo = await inserirSeNovo(() =>
      socialModel.createFollow(followerId, followingId, conn),
    );
    // Só o follow novo notifica: toque duplo não gera duas notificações.
    if (novo) {
      await notificationModel.create(
        { userId: followingId, type: "follow", actorId: followerId },
        conn,
      );
    }
  });
  return estadoDoFollow(followerId, followingId);
}

/** Garante que `followerId` NÃO segue `followingId`. Devolve o estado final. */
export async function unfollow(followerId, followingId) {
  await socialModel.deleteFollow(followerId, followingId);
  return estadoDoFollow(followerId, followingId);
}

export async function listFollowers(userId) {
  await usuarioAtivo(userId);
  return socialModel.listFollowers(userId);
}

export async function listFollowing(userId) {
  await usuarioAtivo(userId);
  return socialModel.listFollowing(userId);
}

// --- likes ---

/** Garante a curtida. Devolve `{ liked, likeCount }`. */
export async function likeCatch(userId, catchId) {
  const captura = await findVisibleCatch(userId, catchId);

  await withTransaction(async (conn) => {
    // RGN-15: uma curtida por usuário por captura — a PK de likes recusa a
    // segunda, e isso vira "já estava curtida".
    const nova = await inserirSeNovo(() => socialModel.createLike(userId, catchId, conn));
    if (nova && captura.userId !== userId) {
      await notificationModel.create(
        { userId: captura.userId, type: "like", actorId: userId, catchId },
        conn,
      );
    }
  });
  return socialModel.likeState(userId, catchId);
}

/** Garante que a curtida não existe. Devolve `{ liked, likeCount }`. */
export async function unlikeCatch(userId, catchId) {
  await findVisibleCatch(userId, catchId);
  await socialModel.deleteLike(userId, catchId);
  return socialModel.likeState(userId, catchId);
}

// --- comments ---

export async function listComments(viewerId, catchId, { isAdmin = false } = {}) {
  await findVisibleCatch(viewerId, catchId, { isAdmin });
  return commentModel.listByCatch(catchId);
}

export async function addComment(userId, catchId, entrada) {
  const { body } = commentSchema.parse(entrada);
  const captura = await findVisibleCatch(userId, catchId);

  return withTransaction(async (conn) => {
    const comentario = await commentModel.create(userId, catchId, body, conn);
    if (captura.userId !== userId) {
      await notificationModel.create(
        { userId: captura.userId, type: "comment", actorId: userId, catchId },
        conn,
      );
    }
    return comentario;
  });
}

/** Só o autor do comentário apaga. */
export async function deleteComment(userId, commentId) {
  if ((await commentModel.deleteForUser(commentId, userId)) === 0) {
    throw httpError(404, "Comentário não encontrado");
  }
}
