import { Router } from "express";
import { listSpecies, getSpecies } from "../controllers/species.controller.js";

export const speciesRoutes = Router();

speciesRoutes.get("/", listSpecies);
speciesRoutes.get("/:id", getSpecies);
