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
// GET /api/dashboard/admin
router.get('/admin', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const [totalBooks, totalCopies, availableCopies, issuedCopies, totalMembers, activeLoans, pendingRequests, overdueLoans, outstandingFines, recentActivity,] = await Promise.all([
            prisma_1.default.book.count(),
            prisma_1.default.bookCopy.count(),
            prisma_1.default.bookCopy.count({ where: { status: 'AVAILABLE' } }),
            prisma_1.default.bookCopy.count({ where: { status: 'ISSUED' } }),
            prisma_1.default.member.count(),
            prisma_1.default.loan.count({ where: { status: 'ACTIVE' } }),
            prisma_1.default.borrowRequest.count({ where: { status: 'PENDING' } }),
            prisma_1.default.loan.count({ where: { status: 'OVERDUE' } }),
            prisma_1.default.fine.aggregate({ where: { isPaid: false }, _sum: { amount: true } }),
            prisma_1.default.activityLog.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: { actor: { select: { name: true, role: true } } },
            }),
        ]);
        // Monthly borrowing trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyLoans = await prisma_1.default.loan.groupBy({
            by: ['issueDate'],
            where: { issueDate: { gte: sixMonthsAgo } },
            _count: { id: true },
        });
        // Popular books (most loaned)
        const popularBooks = await prisma_1.default.loan.groupBy({
            by: ['bookCopyId'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
        });
        return (0, response_1.sendSuccess)(res, {
            stats: {
                totalBooks, totalCopies, availableCopies, issuedCopies,
                totalMembers, activeLoans, pendingRequests, overdueLoans,
                outstandingFines: outstandingFines._sum.amount ?? 0,
            },
            recentActivity,
            monthlyLoans,
            popularBooks,
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/dashboard/librarian
router.get('/librarian', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        const [pendingRequests, activeLoans, overdueLoans, todayIssued, todayReturned,] = await Promise.all([
            prisma_1.default.borrowRequest.count({ where: { status: 'PENDING' } }),
            prisma_1.default.loan.count({ where: { status: 'ACTIVE' } }),
            prisma_1.default.loan.count({ where: { status: 'OVERDUE' } }),
            prisma_1.default.loan.count({ where: { issueDate: { gte: today, lte: todayEnd } } }),
            prisma_1.default.loan.count({ where: { returnDate: { gte: today, lte: todayEnd } } }),
        ]);
        const [recentRequests, overdueList] = await Promise.all([
            prisma_1.default.borrowRequest.findMany({
                where: { status: 'PENDING' },
                take: 5,
                orderBy: { requestDate: 'desc' },
                include: {
                    book: { select: { title: true, availableCopies: true } },
                    member: { include: { user: { select: { name: true } } } },
                },
            }),
            prisma_1.default.loan.findMany({
                where: { status: 'OVERDUE' },
                take: 5,
                orderBy: { dueDate: 'asc' },
                include: {
                    member: { include: { user: { select: { name: true, email: true } } } },
                    bookCopy: { include: { book: { select: { title: true } } } },
                },
            }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            stats: { pendingRequests, activeLoans, overdueLoans, todayIssued, todayReturned },
            recentRequests,
            overdueList,
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/dashboard/member
router.get('/member', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.MEMBER), async (req, res, next) => {
    try {
        const member = await prisma_1.default.member.findUnique({
            where: { userId: req.user.userId },
            include: { user: { select: { name: true } } },
        });
        if (!member)
            return (0, response_1.sendError)(res, 'Member not found', 404);
        const [activeLoans, overdueLoans, pendingRequests, outstandingFines, activeReservations] = await Promise.all([
            prisma_1.default.loan.findMany({
                where: { memberId: member.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
                include: { bookCopy: { include: { book: { select: { title: true, author: true } } } } },
                orderBy: { dueDate: 'asc' },
            }),
            prisma_1.default.loan.count({ where: { memberId: member.id, status: 'OVERDUE' } }),
            prisma_1.default.borrowRequest.count({ where: { memberId: member.id, status: 'PENDING' } }),
            prisma_1.default.fine.aggregate({ where: { memberId: member.id, isPaid: false }, _sum: { amount: true } }),
            prisma_1.default.reservation.count({ where: { memberId: member.id, status: 'ACTIVE' } }),
        ]);
        // Auto-mark overdue loans
        await prisma_1.default.loan.updateMany({
            where: { memberId: member.id, status: 'ACTIVE', dueDate: { lt: new Date() } },
            data: { status: 'OVERDUE' },
        });
        const recentHistory = await prisma_1.default.loan.findMany({
            where: { memberId: member.id, status: 'RETURNED' },
            take: 5,
            orderBy: { returnDate: 'desc' },
            include: { bookCopy: { include: { book: { select: { title: true, author: true } } } } },
        });
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map