"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const response_1 = require("../lib/response");
const router = (0, express_1.Router)();
// GET /api/notifications
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const notifications = await prisma_1.default.notification.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        const unreadCount = notifications.filter(n => !n.isRead).length;
        return (0, response_1.sendSuccess)(res, { notifications, unreadCount });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/notifications/:id/read
router.patch('/:id/read', auth_1.authenticate, async (req, res, next) => {
    try {
        await prisma_1.default.notification.updateMany({
            where: { id: parseInt(req.params.id), userId: req.user.userId },
            data: { isRead: true },
        });
        return (0, response_1.sendSuccess)(res, null, 'Marked as read');
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/notifications/read-all
router.patch('/read-all', auth_1.authenticate, async (req, res, next) => {
    try {
        await prisma_1.default.notification.updateMany({
            where: { userId: req.user.userId, isRead: false },
            data: { isRead: true },
        });
        return (0, response_1.sendSuccess)(res, null, 'All notifications marked as read');
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map