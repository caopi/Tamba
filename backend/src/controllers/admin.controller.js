// Rotas de admin: gestão do catálogo (RGN-16/17) e moderação (RGN-14).
// Todas passam por requireAuth + requireAdmin (routes/admin.routes.js).

import * as speciesService from "../services/species.service.js";
import * as reportService from "../services/report.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/admin/species  -> inclui as desativadas
export const listSpecies = asyncHandler(async (req, res) => {
  res.json(await speciesService.listSpecies(req.user, { includeInactive: "true" }));
});

// POST /api/admin/species
export const createSpecies = asyncHandler(async (req, res) => {
  res.status(201).json(await speciesService.createSpecies(req.user, req.body));
});

// PUT /api/admin/species/:id
export const updateSpecies = asyncHandler(async (req, res) => {
  res.json(await speciesService.updateSpecies(req.user, req.params.id, req.body));
});

// PATCH /api/admin/species/:id/active  { isActive }
export const setSpeciesActive = asyncHandler(async (req, res) => {
  res.json(await speciesService.setSpeciesActive(req.user, req.params.id, req.body));
});

// DELETE /api/admin/species/:id  -> só sem capturas; com capturas, 409 (desative)
export const deleteSpecies = asyncHandler(async (req, res) => {
  await speciesService.deleteSpecies(req.user, req.params.id);
  res.status(204).send();
});

// GET /api/admin/reports  -> fila de denúncias pendentes, agrupada por captura
export const listReports = asyncHandler(async (req, res) => {
  res.json(await reportService.listPendingReports(req.user));
});

// POST /api/admin/catches/:id/review  { hide }
export const reviewCatch = asyncHandler(async (req, res) => {
  await reportService.reviewCatch(req.user, req.params.id, req.body);
  res.status(204).send();
});
