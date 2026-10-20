import { Router } from "express";
import {
  signup,
  login,
  me,
  verifyEmail,
  resendVerification,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { limiteCadastro, limiteLogin, limiteReenvio } from "../middlewares/rateLimit.js";

export const authRoutes = Router();

authRoutes.post("/signup", limiteCadastro, signup);
authRoutes.post("/login", limiteLogin, login);
authRoutes.get("/me", requireAuth, me);
// GET porque é o link clicado no e-mail.
authRoutes.get("/verify-email", verifyEmail);
authRoutes.post("/resend-verification", limiteReenvio, resendVerification);
