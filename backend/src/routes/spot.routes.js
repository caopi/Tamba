import { Router } from "express";
import { listSpots } from "../controllers/spot.controller.js";

export const spotRoutes = Router();

spotRoutes.get("/", listSpots);
