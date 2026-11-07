import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError } from '../lib/response';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/dashboard/admin
router.get('/admin', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalBooks, totalCopies, availableCopies, issuedCopies,
      totalMembers, activeLoans, pendingRequests, overdueLoans,
      outstandingFines, recentActivity,
    ] = await Promise.all([
      prisma.book.count(),
      prisma.bookCopy.count(),
      prisma.bookCopy.count({ where: { status: 'AVAILABLE' } }),
      prisma.bookCopy.count({ where: { status: 'ISSUED' } }),
      prisma.member.count(),
      prisma.loan.count({ where: { status: 'ACTIVE' } }),
      prisma.borrowRequest.count({ where: { status: 'PENDING' } }),
      prisma.loan.count({ where: { status: 'OVERDUE' } }),
      prisma.fine.aggregate({ where: { isPaid: false }, _sum: { amount: true } }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { name: true, role: true } } },
      }),
    ]);

    // Monthly borrowing trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyLoans = await prisma.loan.groupBy({
      by: ['issueDate'],
      where: { issueDate: { gte: sixMonthsAgo } },
      _count: { id: true },
    });

    // Popular books (most loaned)
    const popularBooks = await prisma.loan.groupBy({
      by: ['bookCopyId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return sendSuccess(res, {
      stats: {
        totalBooks, totalCopies, availableCopies, issuedCopies,
        totalMembers, activeLoans, pendingRequests, overdueLoans,
        outstandingFines: outstandingFines._sum.amount ?? 0,
      },
      recentActivity,
      monthlyLoans,
      popularBooks,
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/librarian
router.get('/librarian', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      pendingRequests, activeLoans, overdueLoans, todayIssued, todayReturned,
    ] = await Promise.all([
      prisma.borrowRequest.count({ where: { status: 'PENDING' } }),
      prisma.loan.count({ where: { status: 'ACTIVE' } }),
      prisma.loan.count({ where: { status: 'OVERDUE' } }),
      prisma.loan.count({ where: { issueDate: { gte: today, lte: todayEnd } } }),
      prisma.loan.count({ where: { returnDate: { gte: today, lte: todayEnd } } }),
    ]);

    const [recentRequests, overdueList] = await Promise.all([
      prisma.borrowRequest.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { requestDate: 'desc' },
        include: {
          book: { select: { title: true, availableCopies: true } },
          member: { include: { user: { select: { name: true } } } },
        },
      }),
      prisma.loan.findMany({
        where: { status: 'OVERDUE' },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include: {
          member: { include: { user: { select: { name: true, email: true } } } },
          bookCopy: { include: { book: { select: { title: true } } } },
        },
      }),
    ]);

    return sendSuccess(res, {
      stats: { pendingRequests, activeLoans, overdueLoans, todayIssued, todayReturned },
      recentRequests,
      overdueList,
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/member
router.get('/member', authenticate, authorize(Role.MEMBER), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.member.findUnique({
      where: { userId: req.user!.userId },
      include: { user: { select: { name: true } } },
    });
    if (!member) return sendError(res, 'Member not found', 404);

    const [activeLoans, overdueLoans, pendingRequests, outstandingFines, activeReservations] = await Promise.all([
      prisma.loan.findMany({
        where: { memberId: member.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
        include: { bookCopy: { include: { book: { select: { title: true, author: true } } } } },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.loan.count({ where: { memberId: member.id, status: 'OVERDUE' } }),
      prisma.borrowRequest.count({ where: { memberId: member.id, status: 'PENDING' } }),
      prisma.fine.aggregate({ where: { memberId: member.id, isPaid: false }, _sum: { amount: true } }),
      prisma.reservation.count({ where: { memberId: member.id, status: 'ACTIVE' } }),
    ]);

    // Auto-mark overdue loans
    await prisma.loan.updateMany({
      where: { memberId: member.id, status: 'ACTIVE', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

    const recentHistory = await prisma.loan.findMany({
      where: { memberId: member.id, status: 'RETURNED' },
      take: 5,
      orderBy: { returnDate: 'desc' },
      include: { bookCopy: { include: { book: { select: { title: true, author: true } } } } },
    });

    return sendSuccess(res, {
      member: { name: member.user.name, memberCode: member.memberCode, status: member.status, maxBooksAllowed: member.maxBooksAllowed },
      stats: {
        booksCurrentlyBorrowed: activeLoans.length,
        overdueBooks: overdueLoans,
        pendingRequests,
        outstandingFines: outstandingFines._sum.amount ?? 0,
        activeReservations,
      },
      activeLoans,
      recentHistory,
    });
  } catch (err) { next(err); }
});

export default router;
