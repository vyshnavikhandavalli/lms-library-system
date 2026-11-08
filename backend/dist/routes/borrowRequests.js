"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const response_1 = require("../lib/response");
const client_1 = require("@prisma/client");
const notifications_1 = require("../lib/notifications");
const activityLog_1 = require("../lib/activityLog");
const router = (0, express_1.Router)();
const createRequestSchema = zod_1.z.object({ bookId: zod_1.z.number().int().positive() });
const rejectSchema = zod_1.z.object({ rejectionReason: zod_1.z.string().min(1) });
// POST /api/borrow-requests  — MEMBER submits a borrow request
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.MEMBER), async (req, res, next) => {
    try {
        const { bookId } = createRequestSchema.parse(req.body);
        const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
        if (!member)
            return (0, response_1.sendError)(res, 'Member profile not found', 404);
        if (member.status !== 'ACTIVE')
            return (0, response_1.sendError)(res, 'Your membership is not active', 403);
        const book = await prisma_1.default.book.findUnique({ where: { id: bookId } });
        if (!book)
            return (0, response_1.sendError)(res, 'Book not found', 404);
        // Check active loans count vs limit
        const activeLoans = await prisma_1.default.loan.count({ where: { memberId: member.id, status: { in: ['ACTIVE', 'OVERDUE'] } } });
        if (activeLoans >= member.maxBooksAllowed) {
            return (0, response_1.sendError)(res, `Borrowing limit reached (max ${member.maxBooksAllowed} books)`, 409);
        }
        // Check overdue loans
        const overdueCount = await prisma_1.default.loan.count({ where: { memberId: member.id, status: 'OVERDUE' } });
        if (overdueCount > 0)
            return (0, response_1.sendError)(res, 'You have overdue books. Please return them before borrowing more.', 409);
        // Check unpaid fines
        const unpaidFines = await prisma_1.default.fine.aggregate({ where: { memberId: member.id, isPaid: false }, _sum: { amount: true } });
        if ((unpaidFines._sum.amount ?? 0) > 0) {
            return (0, response_1.sendError)(res, 'You have outstanding fines. Please clear them before borrowing.', 409);
        }
        // Check duplicate active request/loan
        const dupRequest = await prisma_1.default.borrowRequest.findFirst({
            where: { memberId: member.id, bookId, status: { in: ['PENDING', 'APPROVED'] } },
        });
        if (dupRequest)
            return (0, response_1.sendError)(res, 'You already have an active request for this book', 409);
        const dupLoan = await prisma_1.default.loan.findFirst({
            where: { memberId: member.id, bookCopy: { bookId }, status: { in: ['ACTIVE', 'OVERDUE'] } },
        });
        if (dupLoan)
            return (0, response_1.sendError)(res, 'You already have this book borrowed', 409);
        const request = await prisma_1.default.borrowRequest.create({
            data: { memberId: member.id, bookId, status: client_1.BorrowRequestStatus.PENDING },
            include: { book: { select: { title: true } }, member: { include: { user: { select: { name: true } } } } },
        });
        // Notify librarians
        const librarians = await prisma_1.default.user.findMany({ where: { role: 'LIBRARIAN', isActive: true } });
        const memberUser = await prisma_1.default.user.findUnique({ where: { id: req.user.userId } });
        await Promise.all(librarians.map(lib => (0, notifications_1.createNotification)(lib.id, 'BORROW_REQUEST', 'New Borrow Request', `${memberUser?.name ?? 'A member'} requested "${book.title}"`)));
        // Also notify the member
        await (0, notifications_1.createNotification)(req.user.userId, 'BORROW_REQUEST', 'Request Submitted', `Your request for "${book.title}" has been submitted and is pending approval.`);
        return (0, response_1.sendSuccess)(res, request, 'Borrow request submitted', 201);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/borrow-requests
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const where = {};
        if (status)
            where.status = status;
        // Members only see their own
        if (req.user.role === client_1.Role.MEMBER) {
            const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
            if (!member)
                return (0, response_1.sendError)(res, 'Member not found', 404);
            where.memberId = member.id;
        }
        const [total, requests] = await Promise.all([
            prisma_1.default.borrowRequest.count({ where }),
            prisma_1.default.borrowRequest.findMany({
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
        return (0, response_1.sendPaginated)(res, requests, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/borrow-requests/:id/approve
router.patch('/:id/approve', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const request = await prisma_1.default.borrowRequest.findUnique({
            where: { id },
            include: { member: { include: { user: true } }, book: true },
        });
        if (!request)
            return (0, response_1.sendError)(res, 'Request not found', 404);
        if (request.status !== 'PENDING')
            return (0, response_1.sendError)(res, 'Request is no longer pending', 409);
        await prisma_1.default.borrowRequest.update({
            where: { id },
            data: { status: client_1.BorrowRequestStatus.APPROVED, responseDate: new Date(), respondedById: req.user.userId },
        });
        // Notify member
        await (0, notifications_1.createNotification)(request.member.userId, 'APPROVED', 'Request Approved', `Your request for "${request.book.title}" has been approved. Please collect from the library.`);
        await (0, activityLog_1.logActivity)(req.user.userId, 'APPROVE_REQUEST', 'borrow_request', id, { bookTitle: request.book.title });
        return (0, response_1.sendSuccess)(res, null, 'Request approved');
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/borrow-requests/:id/reject
router.patch('/:id/reject', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const { rejectionReason } = rejectSchema.parse(req.body);
        const request = await prisma_1.default.borrowRequest.findUnique({
            where: { id },
            include: { member: { include: { user: true } }, book: true },
        });
        if (!request)
            return (0, response_1.sendError)(res, 'Request not found', 404);
        if (request.status !== 'PENDING')
            return (0, response_1.sendError)(res, 'Request is no longer pending', 409);
        await prisma_1.default.borrowRequest.update({
            where: { id },
            data: { status: client_1.BorrowRequestStatus.REJECTED, responseDate: new Date(), respondedById: req.user.userId, rejectionReason },
        });
        await (0, notifications_1.createNotification)(request.member.userId, 'REJECTED', 'Request Rejected', `Your request for "${request.book.title}" was rejected. Reason: ${rejectionReason}`);
        await (0, activityLog_1.logActivity)(req.user.userId, 'REJECT_REQUEST', 'borrow_request', id, { reason: rejectionReason });
        return (0, response_1.sendSuccess)(res, null, 'Request rejected');
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/borrow-requests/:id/cancel
router.patch('/:id/cancel', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.MEMBER), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
        const request = await prisma_1.default.borrowRequest.findUnique({ where: { id } });
        if (!request || request.memberId !== member?.id)
            return (0, response_1.sendError)(res, 'Request not found', 404);
        if (request.status !== 'PENDING')
            return (0, response_1.sendError)(res, 'Only pending requests can be cancelled', 409);
        await prisma_1.default.borrowRequest.update({ where: { id }, data: { status: client_1.BorrowRequestStatus.CANCELLED } });
        return (0, response_1.sendSuccess)(res, null, 'Request cancelled');
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=borrowRequests.js.map