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
const issueSchema = zod_1.z.object({
    borrowRequestId: zod_1.z.number().int().positive(),
    bookCopyId: zod_1.z.number().int().positive().optional(),
});
const returnSchema = zod_1.z.object({
    condition: zod_1.z.nativeEnum(client_1.CopyCondition).default(client_1.CopyCondition.GOOD),
    notes: zod_1.z.string().optional(),
});
// GET /api/loans
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const search = req.query.search || '';
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { member: { user: { name: { contains: search, mode: 'insensitive' } } } },
                { bookCopy: { book: { title: { contains: search, mode: 'insensitive' } } } },
                { bookCopy: { copyCode: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const [total, loans] = await Promise.all([
            prisma_1.default.loan.count({ where }),
            prisma_1.default.loan.findMany({
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
        return (0, response_1.sendPaginated)(res, loans, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/loans/my  — MEMBER sees own loans
router.get('/my', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.MEMBER), async (req, res, next) => {
    try {
        const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
        if (!member)
            return (0, response_1.sendError)(res, 'Member not found', 404);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const where = { memberId: member.id };
        if (status)
            where.status = status;
        const [total, loans] = await Promise.all([
            prisma_1.default.loan.count({ where }),
            prisma_1.default.loan.findMany({
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
        return (0, response_1.sendPaginated)(res, loans, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/loans/:id
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const loan = await prisma_1.default.loan.findUnique({
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
        if (!loan)
            return (0, response_1.sendError)(res, 'Loan not found', 404);
        return (0, response_1.sendSuccess)(res, loan);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/loans/issue  — Librarian issues a book
router.post('/issue', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const { borrowRequestId, bookCopyId } = issueSchema.parse(req.body);
        const request = await prisma_1.default.borrowRequest.findUnique({
            where: { id: borrowRequestId },
            include: { book: true, member: { include: { user: true } } },
        });
        if (!request)
            return (0, response_1.sendError)(res, 'Borrow request not found', 404);
        if (request.status !== 'APPROVED')
            return (0, response_1.sendError)(res, 'Request must be approved first', 409);
        // Find an available copy
        let copy;
        if (bookCopyId) {
            copy = await prisma_1.default.bookCopy.findUnique({ where: { id: bookCopyId } });
            if (!copy || copy.status !== client_1.CopyStatus.AVAILABLE)
                return (0, response_1.sendError)(res, 'Specified copy is not available', 409);
        }
        else {
            copy = await prisma_1.default.bookCopy.findFirst({
                where: { bookId: request.bookId, status: client_1.CopyStatus.AVAILABLE, condition: { not: client_1.CopyCondition.LOST } },
            });
            if (!copy)
                return (0, response_1.sendError)(res, 'No available copies for this book', 409);
        }
        // Get loan duration from settings
        const durationSetting = await prisma_1.default.librarySetting.findUnique({ where: { key: 'loan_duration_days' } });
        const duration = parseInt(durationSetting?.value ?? '14');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + duration);
        const loan = await prisma_1.default.$transaction(async (tx) => {
            const newLoan = await tx.loan.create({
                data: {
                    borrowRequestId,
                    memberId: request.memberId,
                    bookCopyId: copy.id,
                    issuedById: req.user.userId,
                    issueDate: new Date(),
                    dueDate,
                    status: client_1.LoanStatus.ACTIVE,
                },
                include: {
                    bookCopy: { include: { book: true } },
                    member: { include: { user: { select: { name: true } } } },
                },
            });
            // Update copy status
            await tx.bookCopy.update({ where: { id: copy.id }, data: { status: client_1.CopyStatus.ISSUED } });
            // Decrement available copies
            await tx.book.update({ where: { id: request.bookId }, data: { availableCopies: { decrement: 1 } } });
            return newLoan;
        });
        // Notify member
        await (0, notifications_1.createNotification)(request.member.userId, 'ISSUED', 'Book Issued', `"${request.book.title}" has been issued to you. Due date: ${dueDate.toLocaleDateString('en-IN')}.`);
        await (0, activityLog_1.logActivity)(req.user.userId, 'ISSUE_BOOK', 'loan', loan.id, {
            bookTitle: request.book.title,
            memberName: request.member.user.name,
            dueDate,
        });
        return (0, response_1.sendSuccess)(res, loan, 'Book issued successfully', 201);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/loans/:id/return  — Librarian processes a return
router.post('/:id/return', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const loanId = parseInt(req.params.id);
        const { condition } = returnSchema.parse(req.body);
        const loan = await prisma_1.default.loan.findUnique({
            where: { id: loanId },
            include: {
                bookCopy: { include: { book: true } },
                member: { include: { user: true } },
                fines: { where: { isPaid: false } },
            },
        });
        if (!loan)
            return (0, response_1.sendError)(res, 'Loan not found', 404);
        if (loan.status === client_1.LoanStatus.RETURNED)
            return (0, response_1.sendError)(res, 'Book already returned', 409);
        const returnDate = new Date();
        const isOverdue = returnDate > loan.dueDate;
        // Get fine rate from settings
        const fineRateSetting = await prisma_1.default.librarySetting.findUnique({ where: { key: 'fine_per_day' } });
        const finePerDay = parseFloat(fineRateSetting?.value ?? '5');
        await prisma_1.default.$transaction(async (tx) => {
            // Update loan
            await tx.loan.update({
                where: { id: loanId },
                data: {
                    returnDate,
                    status: client_1.LoanStatus.RETURNED,
                    returnCondition: condition,
                    returnedRecordedById: req.user.userId,
                },
            });
            // Update copy status
            const newCopyStatus = condition === client_1.CopyCondition.LOST ? client_1.CopyStatus.MAINTENANCE :
                condition === client_1.CopyCondition.DAMAGED ? client_1.CopyStatus.MAINTENANCE : client_1.CopyStatus.AVAILABLE;
            await tx.bookCopy.update({ where: { id: loan.bookCopyId }, data: { status: newCopyStatus, condition } });
            // Increment available copies if copy is back in circulation
            if (newCopyStatus === client_1.CopyStatus.AVAILABLE) {
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
            if (condition === client_1.CopyCondition.DAMAGED || condition === client_1.CopyCondition.LOST) {
                const damageAmount = condition === client_1.CopyCondition.LOST ? 500 : 100;
                await tx.fine.create({
                    data: { loanId, memberId: loan.memberId, fineType: condition === client_1.CopyCondition.LOST ? 'LOST' : 'DAMAGED', amount: damageAmount, daysOverdue: 0 },
                });
            }
        });
        // Check reservation queue for this book
        const nextReservation = await prisma_1.default.reservation.findFirst({
            where: { bookId: loan.bookCopy.bookId, status: 'ACTIVE' },
            orderBy: { queuePosition: 'asc' },
            include: { member: { include: { user: true } } },
        });
        if (nextReservation && condition === client_1.CopyCondition.GOOD) {
            const expiryDays = parseInt((await prisma_1.default.librarySetting.findUnique({ where: { key: 'reservation_expiry_days' } }))?.value ?? '3');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiryDays);
            await prisma_1.default.reservation.update({
                where: { id: nextReservation.id },
                data: { notifiedAt: new Date(), expiresAt },
            });
            await (0, notifications_1.createNotification)(nextReservation.member.userId, 'RESERVATION_READY', 'Book Available', `"${loan.bookCopy.book.title}" is now available for you. Please collect within ${expiryDays} days.`);
        }
        // Notify member
        if (isOverdue) {
            await (0, notifications_1.createNotification)(loan.member.userId, 'FINE_GENERATED', 'Overdue Fine Generated', `Your return of "${loan.bookCopy.book.title}" is overdue. A fine has been calculated.`);
        }
        await (0, activityLog_1.logActivity)(req.user.userId, 'RETURN_BOOK', 'loan', loanId, { condition, isOverdue });
        return (0, response_1.sendSuccess)(res, null, 'Book returned successfully');
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=loans.js.map