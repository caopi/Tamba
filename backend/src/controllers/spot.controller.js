import * as spotModel from "../models/spot.model.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/spots -> lista de pesqueiros, usada pelo select do formulário de captura.
// Somente leitura por enquanto; o cadastro de pesqueiros ainda não foi definido.
export const listSpots = asyncHandler(async (_req, res) => {
  res.json(await spotModel.findAll());
});
