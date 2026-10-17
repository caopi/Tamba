import * as speciesService from "../services/species.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/species  -> catálogo ativo (a "Dex"). Público e somente leitura.
export const listSpecies = asyncHandler(async (_req, res) => {
  res.json(await speciesService.listSpecies(null, {}));
});

// GET /api/species/:id
export const getSpecies = asyncHandler(async (req, res) => {
  res.json(await speciesService.getSpecies(req.params.id));
});
