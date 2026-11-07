import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';
import { createNotification } from '../lib/notifications';
import { logActivity } from '../lib/activityLog';

const router = Router();

const paymentSchema = z.object({
  amountPaid: z.number().positive(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/fines
router.get('/', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const isPaid = req.query.isPaid === 'true' ? true : req.query.isPaid === 'false' ? false : undefined;

    const where: Record<string, unknown> = {};
    if (isPaid !== undefined) where.isPaid = isPaid;

    const [total, fines] = await Promise.all([
      prisma.fine.count({ where }),
      prisma.fine.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        include: {
          member: { include: { user: { select: { name: true, email: true } } } },
          loan: { include: { bookCopy: { include: { book: { select: { title: true, isbn: true } } } } } },
          payments: true,
        },
      }),
    ]);

    return sendPaginated(res, fines, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/fines/my  — MEMBER sees own fines
router.get('/my', authenticate, authorize(Role.MEMBER), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
    if (!member) return sendError(res, 'Member not found', 404);

    const fines = await prisma.fine.findMany({
      where: { memberId: member.id },
      orderBy: { generatedAt: 'desc' },
      include: {
        loan: { include: { bookCopy: { include: { book: { select: { title: true } } } } } },
        payments: true,
      },
    });

    const totalOutstanding = fines.filter(f => !f.isPaid).reduce((sum, f) => sum + f.amount, 0);
    return sendSuccess(res, { fines, totalOutstanding });
  } catch (err) { next(err); }
});

// GET /api/fines/member/:memberId
router.get('/member/:memberId', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const fines = await prisma.fine.findMany({
      where: { memberId },
      orderBy: { generatedAt: 'desc' },
      include: {
        loan: { include: { bookCopy: { include: { book: { select: { title: true } } } } } },
        payments: true,
      },
    });
    const totalOutstanding = fines.filter(f => !f.isPaid).reduce((sum, f) => sum + f.amount, 0);
    return sendSuccess(res, { fines, totalOutstanding });
  } catch (err) { next(err); }
});

// POST /api/fines/:id/payments  — record a fine payment
router.post('/:id/payments', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const fineId = parseInt(req.params.id);
    const { amountPaid, paymentMethod, notes } = paymentSchema.parse(req.body);

    const fine = await prisma.fine.findUnique({
      where: { id: fineId },
      include: { member: { include: { user: true } } },
    });
    if (!fine) return sendError(res, 'Fine not found', 404);
    if (fine.isPaid) return sendError(res, 'Fine already paid', 409);

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.finePayment.create({
        data: { fineId, amountPaid, paymentMethod, recordedById: req.user!.userId, notes },
      });
      await tx.fine.update({ where: { id: fineId }, data: { isPaid: true, paidAt: new Date() } });
      return p;
    });

    await createNotification(fine.member.userId, 'FINE_PAID', 'Fine Payment Recorded',
      `Your fine of ₹${fine.amount} has been recorded as paid.`);

    await logActivity(req.user!.userId, 'RECORD_FINE_PAYMENT', 'fine', fineId, { amount: amountPaid });
    return sendSuccess(res, payment, 'Fine payment recorded', 201);
  } catch (err) { next(err); }
});

export default router;
