import { Router } from "express";
import {
  listSpecies,
  createSpecies,
  updateSpecies,
  setSpeciesActive,
  deleteSpecies,
  listSpots,
  createSpot,
  updateSpot,
  setSpotActive,
  deleteSpot,
  listReports,
  reviewCatch,
  catchReports,
  setUserActive,
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

adminRoutes.get("/spots", listSpots);
adminRoutes.post("/spots", createSpot);
adminRoutes.put("/spots/:id", updateSpot);
adminRoutes.patch("/spots/:id/active", setSpotActive);
adminRoutes.delete("/spots/:id", deleteSpot);

adminRoutes.get("/reports", listReports);
adminRoutes.get("/catches/:id/reports", catchReports);
adminRoutes.post("/catches/:id/review", reviewCatch);
adminRoutes.patch("/users/:id/active", setUserActive);
