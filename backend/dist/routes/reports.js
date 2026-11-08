"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const response_1 = require("../lib/response");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// GET /api/reports/borrowing-trends
router.get('/borrowing-trends', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (_req, res, next) => {
    try {
        const months = 6;
        const from = new Date();
        from.setMonth(from.getMonth() - months);
        const loans = await prisma_1.default.loan.findMany({
            where: { issueDate: { gte: from } },
            select: { issueDate: true },
        });
        // Group by month
        const grouped = {};
        for (const l of loans) {
            const key = `${l.issueDate.getFullYear()}-${String(l.issueDate.getMonth() + 1).padStart(2, '0')}`;
            grouped[key] = (grouped[key] || 0) + 1;
        }
        const trend = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, count]) => ({ month, count }));
        return (0, response_1.sendSuccess)(res, trend);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/popular-books
router.get('/popular-books', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (_req, res, next) => {
    try {
        const data = await prisma_1.default.$queryRaw `
      SELECT b.title, b.author, COUNT(l.id) as loan_count
      FROM loans l
      JOIN book_copies bc ON l.book_copy_id = bc.id
      JOIN books b ON bc.book_id = b.id
      GROUP BY b.id, b.title, b.author
      ORDER BY loan_count DESC
      LIMIT 10
    `;
        return (0, response_1.sendSuccess)(res, data.map(d => ({ ...d, loan_count: Number(d.loan_count) })));
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/overdue-summary
router.get('/overdue-summary', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (_req, res, next) => {
    try {
        // Auto-update overdue status first
        await prisma_1.default.loan.updateMany({
            where: { status: 'ACTIVE', dueDate: { lt: new Date() } },
            data: { status: 'OVERDUE' },
        });
        const overdueLoans = await prisma_1.default.loan.findMany({
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
        return (0, response_1.sendSuccess)(res, enriched);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map