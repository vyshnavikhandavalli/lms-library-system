import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { AuthRequest } from '../types';
import { Role, BorrowRequestStatus } from '@prisma/client';
import { createNotification } from '../lib/notifications';
import { logActivity } from '../lib/activityLog';

const router = Router();

const createRequestSchema = z.object({ bookId: z.number().int().positive() });
const rejectSchema = z.object({ rejectionReason: z.string().min(1) });

// POST /api/borrow-requests  — MEMBER submits a borrow request
router.post('/', authenticate, authorize(Role.MEMBER), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bookId } = createRequestSchema.parse(req.body);

    const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
    if (!member) return sendError(res, 'Member profile not found', 404);
    if (member.status !== 'ACTIVE') return sendError(res, 'Your membership is not active', 403);

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return sendError(res, 'Book not found', 404);

    // Check active loans count vs limit
    const activeLoans = await prisma.loan.count({ where: { memberId: member.id, status: { in: ['ACTIVE', 'OVERDUE'] } } });
    if (activeLoans >= member.maxBooksAllowed) {
      return sendError(res, `Borrowing limit reached (max ${member.maxBooksAllowed} books)`, 409);
    }

    // Check overdue loans
    const overdueCount = await prisma.loan.count({ where: { memberId: member.id, status: 'OVERDUE' } });
    if (overdueCount > 0) return sendError(res, 'You have overdue books. Please return them before borrowing more.', 409);

    // Check unpaid fines
    const unpaidFines = await prisma.fine.aggregate({ where: { memberId: member.id, isPaid: false }, _sum: { amount: true } });
    if ((unpaidFines._sum.amount ?? 0) > 0) {
      return sendError(res, 'You have outstanding fines. Please clear them before borrowing.', 409);
    }

    // Check duplicate active request/loan
    const dupRequest = await prisma.borrowRequest.findFirst({
      where: { memberId: member.id, bookId, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (dupRequest) return sendError(res, 'You already have an active request for this book', 409);

    const dupLoan = await prisma.loan.findFirst({
      where: { memberId: member.id, bookCopy: { bookId }, status: { in: ['ACTIVE', 'OVERDUE'] } },
    });
    if (dupLoan) return sendError(res, 'You already have this book borrowed', 409);

    const request = await prisma.borrowRequest.create({
      data: { memberId: member.id, bookId, status: BorrowRequestStatus.PENDING },
      include: { book: { select: { title: true } }, member: { include: { user: { select: { name: true } } } } },
    });

    // Notify librarians
    const librarians = await prisma.user.findMany({ where: { role: 'LIBRARIAN', isActive: true } });
    const memberUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    await Promise.all(librarians.map(lib =>
      createNotification(lib.id, 'BORROW_REQUEST',
        'New Borrow Request',
        `${memberUser?.name ?? 'A member'} requested "${book.title}"`)
    ));
    // Also notify the member
    await createNotification(req.user!.userId, 'BORROW_REQUEST', 'Request Submitted', `Your request for "${book.title}" has been submitted and is pending approval.`);

    return sendSuccess(res, request, 'Borrow request submitted', 201);
  } catch (err) { next(err); }
});

// GET /api/borrow-requests
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as BorrowRequestStatus | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // Members only see their own
    if (req.user!.role === Role.MEMBER) {
      const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
      if (!member) return sendError(res, 'Member not found', 404);
      where.memberId = member.id;
    }

    const [total, requests] = await Promise.all([
      prisma.borrowRequest.count({ where }),
      prisma.borrowRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { requestDate: 'desc' },
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true, availableCopies: true } },
          member: { include: { user: { select: { name: true, email: true } } } },
          respondedBy: { select: { name: true } },
        },
      }),
    ]);

    return sendPaginated(res, requests, total, page, limit);
  } catch (err) { next(err); }
});

// PATCH /api/borrow-requests/:id/approve
router.patch('/:id/approve', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const request = await prisma.borrowRequest.findUnique({
      where: { id },
      include: { member: { include: { user: true } }, book: true },
    });
    if (!request) return sendError(res, 'Request not found', 404);
    if (request.status !== 'PENDING') return sendError(res, 'Request is no longer pending', 409);

    await prisma.borrowRequest.update({
      where: { id },
      data: { status: BorrowRequestStatus.APPROVED, responseDate: new Date(), respondedById: req.user!.userId },
    });

    // Notify member
    await createNotification(request.member.userId, 'APPROVED', 'Request Approved',
      `Your request for "${request.book.title}" has been approved. Please collect from the library.`);

    await logActivity(req.user!.userId, 'APPROVE_REQUEST', 'borrow_request', id, { bookTitle: request.book.title });
    return sendSuccess(res, null, 'Request approved');
  } catch (err) { next(err); }
});

// PATCH /api/borrow-requests/:id/reject
router.patch('/:id/reject', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { rejectionReason } = rejectSchema.parse(req.body);
    const request = await prisma.borrowRequest.findUnique({
      where: { id },
      include: { member: { include: { user: true } }, book: true },
    });
    if (!request) return sendError(res, 'Request not found', 404);
    if (request.status !== 'PENDING') return sendError(res, 'Request is no longer pending', 409);

    await prisma.borrowRequest.update({
      where: { id },
      data: { status: BorrowRequestStatus.REJECTED, responseDate: new Date(), respondedById: req.user!.userId, rejectionReason },
    });

    await createNotification(request.member.userId, 'REJECTED', 'Request Rejected',
      `Your request for "${request.book.title}" was rejected. Reason: ${rejectionReason}`);

    await logActivity(req.user!.userId, 'REJECT_REQUEST', 'borrow_request', id, { reason: rejectionReason });
    return sendSuccess(res, null, 'Request rejected');
  } catch (err) { next(err); }
});

// PATCH /api/borrow-requests/:id/cancel
router.patch('/:id/cancel', authenticate, authorize(Role.MEMBER), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
    const request = await prisma.borrowRequest.findUnique({ where: { id } });
    if (!request || request.memberId !== member?.id) return sendError(res, 'Request not found', 404);
    if (request.status !== 'PENDING') return sendError(res, 'Only pending requests can be cancelled', 409);

    await prisma.borrowRequest.update({ where: { id }, data: { status: BorrowRequestStatus.CANCELLED } });
    return sendSuccess(res, null, 'Request cancelled');
  } catch (err) { next(err); }
});

export default router;
