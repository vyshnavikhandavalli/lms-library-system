import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { AuthRequest } from '../types';
import { Role, LoanStatus, CopyStatus, CopyCondition } from '@prisma/client';
import { createNotification } from '../lib/notifications';
import { logActivity } from '../lib/activityLog';

const router = Router();

const issueSchema = z.object({
  borrowRequestId: z.number().int().positive(),
  bookCopyId: z.number().int().positive().optional(),
});

const returnSchema = z.object({
  condition: z.nativeEnum(CopyCondition).default(CopyCondition.GOOD),
  notes: z.string().optional(),
});

// GET /api/loans
router.get('/', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as LoanStatus | undefined;
    const search = (req.query.search as string) || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { member: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { bookCopy: { book: { title: { contains: search, mode: 'insensitive' } } } },
        { bookCopy: { copyCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, loans] = await Promise.all([
      prisma.loan.count({ where }),
      prisma.loan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: {
          member: { include: { user: { select: { name: true, email: true } } } },
          bookCopy: { include: { book: { include: { category: true } } } },
          issuedBy: { select: { name: true } },
          fines: true,
        },
      }),
    ]);

    return sendPaginated(res, loans, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/loans/my  — MEMBER sees own loans
router.get('/my', authenticate, authorize(Role.MEMBER), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
    if (!member) return sendError(res, 'Member not found', 404);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as LoanStatus | undefined;
    const where: Record<string, unknown> = { memberId: member.id };
    if (status) where.status = status;

    const [total, loans] = await Promise.all([
      prisma.loan.count({ where }),
      prisma.loan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: {
          bookCopy: { include: { book: { include: { category: { select: { name: true } } } } } },
          fines: { select: { id: true, amount: true, isPaid: true, fineType: true } },
        },
      }),
    ]);

    return sendPaginated(res, loans, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/loans/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        member: { include: { user: { select: { name: true, email: true } } } },
        bookCopy: { include: { book: { include: { category: true } } } },
        issuedBy: { select: { name: true } },
        returnedRecordedBy: { select: { name: true } },
        fines: { include: { payments: true } },
        borrowRequest: true,
      },
    });
    if (!loan) return sendError(res, 'Loan not found', 404);
    return sendSuccess(res, loan);
  } catch (err) { next(err); }
});

// POST /api/loans/issue  — Librarian issues a book
router.post('/issue', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { borrowRequestId, bookCopyId } = issueSchema.parse(req.body);

    const request = await prisma.borrowRequest.findUnique({
      where: { id: borrowRequestId },
      include: { book: true, member: { include: { user: true } } },
    });
    if (!request) return sendError(res, 'Borrow request not found', 404);
    if (request.status !== 'APPROVED') return sendError(res, 'Request must be approved first', 409);

    // Find an available copy
    let copy;
    if (bookCopyId) {
      copy = await prisma.bookCopy.findUnique({ where: { id: bookCopyId } });
      if (!copy || copy.status !== CopyStatus.AVAILABLE) return sendError(res, 'Specified copy is not available', 409);
    } else {
      copy = await prisma.bookCopy.findFirst({
        where: { bookId: request.bookId, status: CopyStatus.AVAILABLE, condition: { not: CopyCondition.LOST } },
      });
      if (!copy) return sendError(res, 'No available copies for this book', 409);
    }

    // Get loan duration from settings
    const durationSetting = await prisma.librarySetting.findUnique({ where: { key: 'loan_duration_days' } });
    const duration = parseInt(durationSetting?.value ?? '14');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + duration);

    const loan = await prisma.$transaction(async (tx) => {
      const newLoan = await tx.loan.create({
        data: {
          borrowRequestId,
          memberId: request.memberId,
          bookCopyId: copy!.id,
          issuedById: req.user!.userId,
          issueDate: new Date(),
          dueDate,
          status: LoanStatus.ACTIVE,
        },
        include: {
          bookCopy: { include: { book: true } },
          member: { include: { user: { select: { name: true } } } },
        },
      });

      // Update copy status
      await tx.bookCopy.update({ where: { id: copy!.id }, data: { status: CopyStatus.ISSUED } });

      // Decrement available copies
      await tx.book.update({ where: { id: request.bookId }, data: { availableCopies: { decrement: 1 } } });

      return newLoan;
    });

    // Notify member
    await createNotification(request.member.userId, 'ISSUED', 'Book Issued',
      `"${request.book.title}" has been issued to you. Due date: ${dueDate.toLocaleDateString('en-IN')}.`);

    await logActivity(req.user!.userId, 'ISSUE_BOOK', 'loan', loan.id, {
      bookTitle: request.book.title,
      memberName: request.member.user.name,
      dueDate,
    });

    return sendSuccess(res, loan, 'Book issued successfully', 201);
  } catch (err) { next(err); }
});

// POST /api/loans/:id/return  — Librarian processes a return
router.post('/:id/return', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const loanId = parseInt(req.params.id);
    const { condition } = returnSchema.parse(req.body);

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        bookCopy: { include: { book: true } },
        member: { include: { user: true } },
        fines: { where: { isPaid: false } },
      },
    });
    if (!loan) return sendError(res, 'Loan not found', 404);
    if (loan.status === LoanStatus.RETURNED) return sendError(res, 'Book already returned', 409);

    const returnDate = new Date();
    const isOverdue = returnDate > loan.dueDate;

    // Get fine rate from settings
    const fineRateSetting = await prisma.librarySetting.findUnique({ where: { key: 'fine_per_day' } });
    const finePerDay = parseFloat(fineRateSetting?.value ?? '5');

    await prisma.$transaction(async (tx) => {
      // Update loan
      await tx.loan.update({
        where: { id: loanId },
        data: {
          returnDate,
          status: LoanStatus.RETURNED,
          returnCondition: condition,
          returnedRecordedById: req.user!.userId,
        },
      });

      // Update copy status
      const newCopyStatus = condition === CopyCondition.LOST ? CopyStatus.MAINTENANCE :
                            condition === CopyCondition.DAMAGED ? CopyStatus.MAINTENANCE : CopyStatus.AVAILABLE;
      await tx.bookCopy.update({ where: { id: loan.bookCopyId }, data: { status: newCopyStatus, condition } });

      // Increment available copies if copy is back in circulation
      if (newCopyStatus === CopyStatus.AVAILABLE) {
        await tx.book.update({ where: { id: loan.bookCopy.bookId }, data: { availableCopies: { increment: 1 } } });
      }

      // Generate overdue fine if applicable (only if no existing unpaid fine)
      if (isOverdue && loan.fines.length === 0) {
        const daysOverdue = Math.ceil((returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const fineAmount = daysOverdue * finePerDay;
        await tx.fine.create({
          data: { loanId, memberId: loan.memberId, fineType: 'OVERDUE', amount: fineAmount, daysOverdue },
        });
      }

      // Generate damaged/lost fine
      if (condition === CopyCondition.DAMAGED || condition === CopyCondition.LOST) {
        const damageAmount = condition === CopyCondition.LOST ? 500 : 100;
        await tx.fine.create({
          data: { loanId, memberId: loan.memberId, fineType: condition === CopyCondition.LOST ? 'LOST' : 'DAMAGED', amount: damageAmount, daysOverdue: 0 },
        });
      }
    });

    // Check reservation queue for this book
    const nextReservation = await prisma.reservation.findFirst({
      where: { bookId: loan.bookCopy.bookId, status: 'ACTIVE' },
      orderBy: { queuePosition: 'asc' },
      include: { member: { include: { user: true } } },
    });
    if (nextReservation && condition === CopyCondition.GOOD) {
      const expiryDays = parseInt((await prisma.librarySetting.findUnique({ where: { key: 'reservation_expiry_days' } }))?.value ?? '3');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
      await prisma.reservation.update({
        where: { id: nextReservation.id },
        data: { notifiedAt: new Date(), expiresAt },
      });
      await createNotification(nextReservation.member.userId, 'RESERVATION_READY', 'Book Available',
        `"${loan.bookCopy.book.title}" is now available for you. Please collect within ${expiryDays} days.`);
    }

    // Notify member
    if (isOverdue) {
      await createNotification(loan.member.userId, 'FINE_GENERATED', 'Overdue Fine Generated',
        `Your return of "${loan.bookCopy.book.title}" is overdue. A fine has been calculated.`);
    }

    await logActivity(req.user!.userId, 'RETURN_BOOK', 'loan', loanId, { condition, isOverdue });
    return sendSuccess(res, null, 'Book returned successfully');
  } catch (err) { next(err); }
});

export default router;
