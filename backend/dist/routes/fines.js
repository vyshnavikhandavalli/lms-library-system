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
const paymentSchema = zod_1.z.object({
    amountPaid: zod_1.z.number().positive(),
    paymentMethod: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
// GET /api/fines
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const isPaid = req.query.isPaid === 'true' ? true : req.query.isPaid === 'false' ? false : undefined;
        const where = {};
        if (isPaid !== undefined)
            where.isPaid = isPaid;
        const [total, fines] = await Promise.all([
            prisma_1.default.fine.count({ where }),
            prisma_1.default.fine.findMany({
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
        return (0, response_1.sendPaginated)(res, fines, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/fines/my  — MEMBER sees own fines
router.get('/my', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.MEMBER), async (req, res, next) => {
    try {
        const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
        if (!member)
            return (0, response_1.sendError)(res, 'Member not found', 404);
        const fines = await prisma_1.default.fine.findMany({
            where: { memberId: member.id },
            orderBy: { generatedAt: 'desc' },
            include: {
                loan: { include: { bookCopy: { include: { book: { select: { title: true } } } } } },
                payments: true,
            },
        });
        const totalOutstanding = fines.filter(f => !f.isPaid).reduce((sum, f) => sum + f.amount, 0);
        return (0, response_1.sendSuccess)(res, { fines, totalOutstanding });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/fines/member/:memberId
router.get('/member/:memberId', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const memberId = parseInt(req.params.memberId);
        const fines = await prisma_1.default.fine.findMany({
            where: { memberId },
            orderBy: { generatedAt: 'desc' },
            include: {
                loan: { include: { bookCopy: { include: { book: { select: { title: true } } } } } },
                payments: true,
            },
        });
        const totalOutstanding = fines.filter(f => !f.isPaid).reduce((sum, f) => sum + f.amount, 0);
        return (0, response_1.sendSuccess)(res, { fines, totalOutstanding });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/fines/:id/payments  — record a fine payment
router.post('/:id/payments', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const fineId = parseInt(req.params.id);
        const { amountPaid, paymentMethod, notes } = paymentSchema.parse(req.body);
        const fine = await prisma_1.default.fine.findUnique({
            where: { id: fineId },
            include: { member: { include: { user: true } } },
        });
        if (!fine)
            return (0, response_1.sendError)(res, 'Fine not found', 404);
        if (fine.isPaid)
            return (0, response_1.sendError)(res, 'Fine already paid', 409);
        const payment = await prisma_1.default.$transaction(async (tx) => {
            const p = await tx.finePayment.create({
                data: { fineId, amountPaid, paymentMethod, recordedById: req.user.userId, notes },
            });
            await tx.fine.update({ where: { id: fineId }, data: { isPaid: true, paidAt: new Date() } });
            return p;
        });
        await (0, notifications_1.createNotification)(fine.member.userId, 'FINE_PAID', 'Fine Payment Recorded', `Your fine of ₹${fine.amount} has been recorded as paid.`);
        await (0, activityLog_1.logActivity)(req.user.userId, 'RECORD_FINE_PAYMENT', 'fine', fineId, { amount: amountPaid });
        return (0, response_1.sendSuccess)(res, payment, 'Fine payment recorded', 201);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=fines.js.map