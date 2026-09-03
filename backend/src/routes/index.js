import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { catchRoutes } from "./catch.routes.js";
import { speciesRoutes } from "./species.routes.js";
import { spotRoutes } from "./spot.routes.js";

export const routes = Router();

routes.get("/health", (_req, res) => res.json({ status: "ok" }));

routes.use("/auth", authRoutes);
routes.use("/catches", catchRoutes);
routes.use("/species", speciesRoutes);
routes.use("/spots", spotRoutes);
