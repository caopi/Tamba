import { Router } from "express";
import {
  search,
  suggestions,
  updateMe,
  getProfile,
  listCatches,
  listFollowers,
  listFollowing,
  follow,
  unfollow,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const userRoutes = Router();

userRoutes.use(requireAuth);

// Os dados do próprio usuário são lidos em GET /api/auth/me.
userRoutes.patch("/me", updateMe);
// Antes do "/:id", senão "search" seria lido como um id.
userRoutes.get("/search", search);
userRoutes.get("/suggestions", suggestions);
userRoutes.get("/:id", getProfile);
userRoutes.get("/:id/catches", listCatches);
userRoutes.get("/:id/followers", listFollowers);
userRoutes.get("/:id/following", listFollowing);
userRoutes.post("/:id/follow", follow);
userRoutes.delete("/:id/follow", unfollow);
