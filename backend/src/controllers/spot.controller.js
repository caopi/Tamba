import * as spotService from "../services/spot.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/spots -> pesqueiros ativos, para o formulário de captura. Público e
// somente leitura; o cadastro é pelas rotas de admin (/api/admin/spots).
export const listSpots = asyncHandler(async (_req, res) => {
  res.json(await spotService.listSpots(null, {}));
});
