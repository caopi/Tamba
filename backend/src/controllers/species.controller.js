import * as speciesModel from "../models/species.model.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { httpError } from "../middlewares/errorHandler.js";

// GET /api/species  -> catálogo completo (a "Dex"). Público e somente leitura.
export const listSpecies = asyncHandler(async (_req, res) => {
  res.json(await speciesModel.findAll());
});

// GET /api/species/:id
export const getSpecies = asyncHandler(async (req, res) => {
  const especie = await speciesModel.findById(req.params.id);
  if (!especie) throw httpError(404, "Espécie não encontrada");
  res.json(especie);
});
