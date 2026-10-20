import * as healthService from "../services/health.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/health  -> sempre 200; { status: "ok" } ou { status: "degraded", ... }
export const health = asyncHandler(async (_req, res) => {
  res.json(await healthService.getHealth());
});
