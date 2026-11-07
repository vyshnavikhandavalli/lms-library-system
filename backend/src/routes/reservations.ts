import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

const router = Router();

const createSchema = z.object({ bookId: z.number().int().positive() });

// POST /api/reservations
router.post('/', authenticate, authorize(Role.MEMBER), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bookId } = createSchema.parse(req.body);
    const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
    if (!member) return sendError(res, 'Member not found', 404);
    if (member.status !== 'ACTIVE') return sendError(res, 'Membership not active', 403);

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return sendError(res, 'Book not found', 404);
    if (book.availableCopies > 0) return sendError(res, 'Book is currently available — please submit a borrow request instead', 409);

    // Check duplicate reservation
    const dup = await prisma.reservation.findFirst({
      where: { memberId: member.id, bookId, status: 'ACTIVE' },
    });
    if (dup) return sendError(res, 'You already have an active reservation for this book', 409);

    // Queue position
    const queueCount = await prisma.reservation.count({ where: { bookId, status: 'ACTIVE' } });
    const reservation = await prisma.reservation.create({
      data: { memberId: member.id, bookId, queuePosition: queueCount + 1, status: 'ACTIVE' },
      include: { book: { select: { title: true } } },
    });

    return sendSuccess(res, reservation, `Reservation placed. Queue position: ${reservation.queuePosition}`, 201);
  } catch (err) { next(err); }
});

// GET /api/reservations
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const where: Record<string, unknown> = {};

    if (req.user!.role === Role.MEMBER) {
      const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
      if (!member) return sendError(res, 'Member not found', 404);
      where.memberId = member.id;
    } else {
      if (req.query.status) where.status = req.query.status;
    }

    const [total, reservations] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ bookId: 'asc' }, { queuePosition: 'asc' }],
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } },
          member: { include: { user: { select: { name: true, email: true } } } },
        },
      }),
    ]);

    return sendPaginated(res, reservations, total, page, limit);
  } catch (err) { next(err); }
});

// DELETE /api/reservations/:id  — MEMBER cancels
router.delete('/:id', authenticate, authorize(Role.MEMBER), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation || reservation.memberId !== member?.id) return sendError(res, 'Reservation not found', 404);
    if (reservation.status !== 'ACTIVE') return sendError(res, 'Only active reservations can be cancelled', 409);

    await prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
    return sendSuccess(res, null, 'Reservation cancelled');
  } catch (err) { next(err); }
});

export default router;
