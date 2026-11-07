import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess } from '../lib/response';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/reports/borrowing-trends
router.get('/borrowing-trends', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (_req, res: Response, next: NextFunction) => {
  try {
    const months = 6;
    const from = new Date();
    from.setMonth(from.getMonth() - months);

    const loans = await prisma.loan.findMany({
      where: { issueDate: { gte: from } },
      select: { issueDate: true },
    });

    // Group by month
    const grouped: Record<string, number> = {};
    for (const l of loans) {
      const key = `${l.issueDate.getFullYear()}-${String(l.issueDate.getMonth() + 1).padStart(2, '0')}`;
      grouped[key] = (grouped[key] || 0) + 1;
    }

    const trend = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    return sendSuccess(res, trend);
  } catch (err) { next(err); }
});

// GET /api/reports/popular-books
router.get('/popular-books', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (_req, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.$queryRaw<Array<{ title: string; author: string; loan_count: bigint }>>`
      SELECT b.title, b.author, COUNT(l.id) as loan_count
      FROM loans l
      JOIN book_copies bc ON l.book_copy_id = bc.id
      JOIN books b ON bc.book_id = b.id
      GROUP BY b.id, b.title, b.author
      ORDER BY loan_count DESC
      LIMIT 10
    `;
    return sendSuccess(res, data.map(d => ({ ...d, loan_count: Number(d.loan_count) })));
  } catch (err) { next(err); }
});

// GET /api/reports/overdue-summary
router.get('/overdue-summary', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (_req, res: Response, next: NextFunction) => {
  try {
    // Auto-update overdue status first
    await prisma.loan.updateMany({
      where: { status: 'ACTIVE', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

    const overdueLoans = await prisma.loan.findMany({
      where: { status: 'OVERDUE' },
      orderBy: { dueDate: 'asc' },
      include: {
        member: { include: { user: { select: { name: true, email: true } } } },
        bookCopy: { include: { book: { select: { title: true, isbn: true } } } },
        fines: { where: { isPaid: false } },
      },
    });

    const now = new Date();
    const enriched = overdueLoans.map(l => ({
      ...l,
      daysOverdue: Math.ceil((now.getTime() - l.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    return sendSuccess(res, enriched);
  } catch (err) { next(err); }
});

export default router;
