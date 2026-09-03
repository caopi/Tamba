import { Router } from "express";
import { signup, login, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const authRoutes = Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.get("/me", requireAuth, me);
