import { Router } from "express";
import { parsePhoto, uploadPhoto } from "../controllers/upload.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { limiteUpload } from "../middlewares/rateLimit.js";

export const uploadRoutes = Router();

// requireAuth antes do multer: quem não está logado nem chega a mandar bytes.
// O limite vem logo depois, porque conta por usuário (req.userId).
uploadRoutes.post("/", requireAuth, limiteUpload, parsePhoto, uploadPhoto);
