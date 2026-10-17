import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { userRoutes } from "./user.routes.js";
import { catchRoutes } from "./catch.routes.js";
import { speciesRoutes } from "./species.routes.js";
import { spotRoutes } from "./spot.routes.js";
import { adminRoutes } from "./admin.routes.js";
import { uploadRoutes } from "./upload.routes.js";
import {
  feedRoutes,
  dexRoutes,
  favoriteRoutes,
  notificationRoutes,
  commentRoutes,
} from "./social.routes.js";

export const routes = Router();

routes.get("/health", (_req, res) => res.json({ status: "ok" }));

routes.use("/auth", authRoutes);
routes.use("/users", userRoutes);
routes.use("/catches", catchRoutes);
routes.use("/comments", commentRoutes);
routes.use("/feed", feedRoutes);
routes.use("/dex", dexRoutes);
routes.use("/favorites", favoriteRoutes);
routes.use("/notifications", notificationRoutes);
routes.use("/species", speciesRoutes);
routes.use("/spots", spotRoutes);
routes.use("/admin", adminRoutes);
routes.use("/uploads", uploadRoutes);
