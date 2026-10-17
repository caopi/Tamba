import { Router } from "express";
import {
  signup,
  login,
  me,
  verifyEmail,
  resendVerification,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const authRoutes = Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.get("/me", requireAuth, me);
// GET porque é o link clicado no e-mail.
authRoutes.get("/verify-email", verifyEmail);
authRoutes.post("/resend-verification", resendVerification);
