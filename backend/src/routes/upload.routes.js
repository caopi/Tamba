import { Router } from "express";
import { parsePhoto, uploadPhoto } from "../controllers/upload.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const uploadRoutes = Router();

// requireAuth antes do multer: quem não está logado nem chega a mandar bytes.
uploadRoutes.post("/", requireAuth, parsePhoto, uploadPhoto);
