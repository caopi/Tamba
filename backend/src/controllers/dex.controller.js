import * as dexService from "../services/dex.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/dex  -> { total, captured, species[] } do usuário logado
export const getDex = asyncHandler(async (req, res) => {
  // Admin também recebe as espécies desativadas (UC010).
  res.json(await dexService.getDex(req.userId, { isAdmin: req.user.role === "admin" }));
});

// GET /api/dex/stats
export const getStats = asyncHandler(async (req, res) => {
  res.json(await dexService.getStats(req.userId));
});

// GET /api/favorites
export const listFavorites = asyncHandler(async (req, res) => {
  res.json(await dexService.listFavorites(req.userId));
});

// POST /api/favorites/:speciesId  -> idempotente; devolve { favorite }
export const addFavorite = asyncHandler(async (req, res) => {
  res.json(await dexService.addFavorite(req.userId, req.params.speciesId));
});

// DELETE /api/favorites/:speciesId  -> idempotente; devolve { favorite }
export const removeFavorite = asyncHandler(async (req, res) => {
  res.json(await dexService.removeFavorite(req.userId, req.params.speciesId));
});
