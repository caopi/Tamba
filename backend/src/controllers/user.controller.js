import * as userService from "../services/user.service.js";
import * as catchService from "../services/catch.service.js";
import * as socialService from "../services/social.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/users/search?q=...  -> busca por nome ou apelido (REQ-41/42)
export const search = asyncHandler(async (req, res) => {
  res.json(await userService.searchUsers(req.userId, req.query));
});

// GET /api/users/suggestions  -> quem seguir (REQ-36)
export const suggestions = asyncHandler(async (req, res) => {
  res.json(await userService.suggestUsers(req.userId));
});

// PATCH /api/users/me  -> nome, apelido, avatar, unidade, privacidade (RGN-06)
export const updateMe = asyncHandler(async (req, res) => {
  res.json(await userService.updateMe(req.userId, req.body));
});

// GET /api/users/:id  -> perfil público, com seguidores e estatísticas
export const getProfile = asyncHandler(async (req, res) => {
  res.json(await userService.getPublicProfile(req.userId, req.params.id));
});

// GET /api/users/:id/catches
export const listCatches = asyncHandler(async (req, res) => {
  res.json(await catchService.listUserCatches(req.userId, req.params.id));
});

// GET /api/users/:id/followers
export const listFollowers = asyncHandler(async (req, res) => {
  res.json(await socialService.listFollowers(req.params.id));
});

// GET /api/users/:id/following
export const listFollowing = asyncHandler(async (req, res) => {
  res.json(await socialService.listFollowing(req.params.id));
});

// POST /api/users/:id/follow  -> idempotente; devolve { following, followers }
export const follow = asyncHandler(async (req, res) => {
  res.json(await socialService.follow(req.userId, req.params.id));
});

// DELETE /api/users/:id/follow  -> idempotente; devolve { following, followers }
export const unfollow = asyncHandler(async (req, res) => {
  res.json(await socialService.unfollow(req.userId, req.params.id));
});
