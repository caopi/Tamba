import * as socialService from "../services/social.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// DELETE /api/comments/:id  -> só o autor do comentário
export const deleteComment = asyncHandler(async (req, res) => {
  await socialService.deleteComment(req.userId, req.params.id);
  res.status(204).send();
});
