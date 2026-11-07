import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../lib/response';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    return sendSuccess(res, { notifications, unreadCount });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: parseInt(req.params.id), userId: req.user!.userId },
      data: { isRead: true },
    });
    return sendSuccess(res, null, 'Marked as read');
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
});

export default router;
