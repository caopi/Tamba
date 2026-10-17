import * as notificationService from "../services/notification.service.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// GET /api/notifications?unreadOnly=true&limit=30  -> { items, unreadCount }
export const list = asyncHandler(async (req, res) => {
  res.json(await notificationService.listNotifications(req.userId, req.query));
});

// PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.userId, req.params.id);
  res.status(204).send();
});

// POST /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.userId);
  res.status(204).send();
});
