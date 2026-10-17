import { Router } from "express";
import {
  listMyCatches,
  getCatch,
  createCatch,
  updateCatch,
  deleteCatch,
  like,
  unlike,
  listComments,
  addComment,
  report,
} from "../controllers/catch.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const catchRoutes = Router();

// Todas as rotas de captura são privadas. Quem pode ver o quê (RGN-12/13)
// é decidido no catch.service.
catchRoutes.use(requireAuth);

catchRoutes.get("/", listMyCatches);
catchRoutes.get("/:id", getCatch);
catchRoutes.post("/", createCatch);
catchRoutes.put("/:id", updateCatch);
catchRoutes.delete("/:id", deleteCatch);

catchRoutes.post("/:id/like", like);
catchRoutes.delete("/:id/like", unlike);
catchRoutes.get("/:id/comments", listComments);
catchRoutes.post("/:id/comments", addComment);
catchRoutes.post("/:id/reports", report);
