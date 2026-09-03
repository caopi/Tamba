import { Router } from "express";
import {
  listMyCatches,
  getCatch,
  createCatch,
  updateCatch,
  deleteCatch,
} from "../controllers/catch.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const catchRoutes = Router();

// Todas as rotas de captura sao privadas: o usuário só enxerga o que e dele.
catchRoutes.use(requireAuth);

catchRoutes.get("/", listMyCatches);
catchRoutes.get("/:id", getCatch);
catchRoutes.post("/", createCatch);
catchRoutes.put("/:id", updateCatch);
catchRoutes.delete("/:id", deleteCatch);
