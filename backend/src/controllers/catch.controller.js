import * as catchService from "../services/catch.service.js";
import * as socialService from "../services/social.service.js";
import * as reportService from "../services/report.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/catches  -> histórico do usuário logado (inclui as ocultas, com isHidden)
export const listMyCatches = asyncHandler(async (req, res) => {
  res.json(await catchService.listMyCatches(req.userId));
});

// GET /api/feed?scope=following|all|reported&order=recent|engagement&cursor=&limit=
// (reported: só admin)
export const getFeed = asyncHandler(async (req, res) => {
  res.json(await catchService.getFeed(req.userId, req.query, { isAdmin: req.user.role === "admin" }));
});

// GET /api/catches/:id
export const getCatch = asyncHandler(async (req, res) => {
  res.json(await catchService.getCatch(req.userId, req.params.id, { isAdmin: req.user.role === "admin" }));
});

// POST /api/catches
export const createCatch = asyncHandler(async (req, res) => {
  res.status(201).json(await catchService.createCatch(req.userId, req.body));
});

// PUT /api/catches/:id
export const updateCatch = asyncHandler(async (req, res) => {
  res.json(await catchService.updateCatch(req.userId, req.params.id, req.body));
});

// DELETE /api/catches/:id
export const deleteCatch = asyncHandler(async (req, res) => {
  await catchService.deleteCatch(req.userId, req.params.id);
  res.status(204).send();
});

// POST /api/catches/:id/like  -> idempotente; devolve { liked, likeCount }
export const like = asyncHandler(async (req, res) => {
  res.json(await socialService.likeCatch(req.userId, req.params.id));
});

// DELETE /api/catches/:id/like  -> idempotente; devolve { liked, likeCount }
export const unlike = asyncHandler(async (req, res) => {
  res.json(await socialService.unlikeCatch(req.userId, req.params.id));
});

// GET /api/catches/:id/comments
export const listComments = asyncHandler(async (req, res) => {
  res.json(await socialService.listComments(req.userId, req.params.id, { isAdmin: req.user.role === "admin" }));
});

// POST /api/catches/:id/comments  { body }
export const addComment = asyncHandler(async (req, res) => {
  res.status(201).json(await socialService.addComment(req.userId, req.params.id, req.body));
});

// POST /api/catches/:id/reports  { reason }
export const report = asyncHandler(async (req, res) => {
  await reportService.reportCatch(req.userId, req.params.id, req.body);
  res.status(201).json({ message: "Denúncia registrada. Obrigado por avisar." });
});
