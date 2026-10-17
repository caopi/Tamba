// Rotas pequenas, que não pertencem a um recurso maior: feed, Dex, favoritos,
// notificações e exclusão de comentário. Todas privadas.

import { Router } from "express";
import { getFeed } from "../controllers/catch.controller.js";
import { deleteComment } from "../controllers/comment.controller.js";
import {
  getDex,
  getStats,
  listFavorites,
  addFavorite,
  removeFavorite,
} from "../controllers/dex.controller.js";
import * as notifications from "../controllers/notification.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const feedRoutes = Router().use(requireAuth).get("/", getFeed);

export const dexRoutes = Router()
  .use(requireAuth)
  .get("/", getDex)
  .get("/stats", getStats);

export const favoriteRoutes = Router()
  .use(requireAuth)
  .get("/", listFavorites)
  .post("/:speciesId", addFavorite)
  .delete("/:speciesId", removeFavorite);

export const notificationRoutes = Router()
  .use(requireAuth)
  .get("/", notifications.list)
  .post("/read-all", notifications.markAllRead)
  .patch("/:id/read", notifications.markRead);

export const commentRoutes = Router().use(requireAuth).delete("/:id", deleteComment);
