// Rotas de admin: gestão do catálogo (UC010, RGN-16/17), dos pesqueiros (UC012), moderação
// (UC011, RGN-14) e desativação de conta (UC002, lado admin). Não existe área
// de admin no frontend: estas ações aparecem dentro das telas normais.
// Todas passam por requireAuth + requireAdmin (routes/admin.routes.js).

import * as speciesService from "../services/species.service.js";
import * as spotService from "../services/spot.service.js";
import * as reportService from "../services/report.service.js";
import * as userService from "../services/user.service.js";
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

// GET /api/admin/spots  -> inclui os desativados
export const listSpots = asyncHandler(async (req, res) => {
  res.json(await spotService.listSpots(req.user, { includeInactive: "true" }));
});

// POST /api/admin/spots  { name, location }  -> 409 SPOT_TAKEN se o par já existe
export const createSpot = asyncHandler(async (req, res) => {
  res.status(201).json(await spotService.createSpot(req.user, req.body));
});

// PUT /api/admin/spots/:id
export const updateSpot = asyncHandler(async (req, res) => {
  res.json(await spotService.updateSpot(req.user, req.params.id, req.body));
});

// PATCH /api/admin/spots/:id/active  { isActive }
export const setSpotActive = asyncHandler(async (req, res) => {
  res.json(await spotService.setSpotActive(req.user, req.params.id, req.body));
});

// DELETE /api/admin/spots/:id  -> só sem capturas; com capturas, 409 (desative)
export const deleteSpot = asyncHandler(async (req, res) => {
  await spotService.deleteSpot(req.user, req.params.id);
  res.status(204).send();
});

// GET /api/admin/reports  -> fila de denúncias pendentes, agrupada por captura
export const listReports = asyncHandler(async (req, res) => {
  res.json(await reportService.listPendingReports(req.user));
});

// GET /api/admin/catches/:id/reports  -> { isHidden, pendingCount, reports[] }
export const catchReports = asyncHandler(async (req, res) => {
  res.json(await reportService.listCatchReports(req.user, req.params.id));
});

// PATCH /api/admin/users/:id/active  { isActive }  (UC002, lado admin)
export const setUserActive = asyncHandler(async (req, res) => {
  res.json(await userService.setUserActive(req.user, req.params.id, req.body));
});

// POST /api/admin/catches/:id/review  { hide }
export const reviewCatch = asyncHandler(async (req, res) => {
  await reportService.reviewCatch(req.user, req.params.id, req.body);
  res.status(204).send();
});
