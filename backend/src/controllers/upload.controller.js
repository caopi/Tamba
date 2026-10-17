import multer from "multer";
import * as uploadService from "../services/upload.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { httpError } from "../middlewares/errorHandler.js";

// Em memória: o arquivo só vai para o disco depois de o service conferir o
// conteúdo. Uma foto por request — o frontend manda cada uma separada, para
// mostrar o progresso e repetir só a que falhou.
const receberFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadService.MAX_BYTES, files: 1 },
}).single("photo");

/** Roda o multer e traduz os erros dele para mensagens da API. */
export function parsePhoto(req, res, next) {
  receberFoto(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      const mb = uploadService.MAX_BYTES / 1024 / 1024;
      return next(httpError(413, `Foto grande demais (máximo de ${mb} MB)`));
    }
    if (err instanceof multer.MulterError) {
      return next(httpError(400, "Envie uma única foto no campo 'photo'"));
    }
    next(err);
  });
}

// POST /api/uploads  (multipart, campo "photo")  -> 201 { id, url }
export const uploadPhoto = asyncHandler(async (req, res) => {
  res.status(201).json(await uploadService.savePhoto(req.file));
});
