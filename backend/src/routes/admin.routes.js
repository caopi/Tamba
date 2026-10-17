import { Router } from "express";
import {
  listSpecies,
  createSpecies,
  updateSpecies,
  setSpeciesActive,
  deleteSpecies,
  listReports,
  reviewCatch,
} from "../controllers/admin.controller.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

export const adminRoutes = Router();

// Tudo aqui é só para admin. A ordem importa: primeiro descobre quem é.
adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get("/species", listSpecies);
adminRoutes.post("/species", createSpecies);
adminRoutes.put("/species/:id", updateSpecies);
adminRoutes.patch("/species/:id/active", setSpeciesActive);
adminRoutes.delete("/species/:id", deleteSpecies);

adminRoutes.get("/reports", listReports);
adminRoutes.post("/catches/:id/review", reviewCatch);
