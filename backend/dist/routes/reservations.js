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
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({ bookId: zod_1.z.number().int().positive() });
// POST /api/reservations
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.MEMBER), async (req, res, next) => {
    try {
        const { bookId } = createSchema.parse(req.body);
        const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
        if (!member)
            return (0, response_1.sendError)(res, 'Member not found', 404);
        if (member.status !== 'ACTIVE')
            return (0, response_1.sendError)(res, 'Membership not active', 403);
        const book = await prisma_1.default.book.findUnique({ where: { id: bookId } });
        if (!book)
            return (0, response_1.sendError)(res, 'Book not found', 404);
        if (book.availableCopies > 0)
            return (0, response_1.sendError)(res, 'Book is currently available — please submit a borrow request instead', 409);
        // Check duplicate reservation
        const dup = await prisma_1.default.reservation.findFirst({
            where: { memberId: member.id, bookId, status: 'ACTIVE' },
        });
        if (dup)
            return (0, response_1.sendError)(res, 'You already have an active reservation for this book', 409);
        // Queue position
        const queueCount = await prisma_1.default.reservation.count({ where: { bookId, status: 'ACTIVE' } });
        const reservation = await prisma_1.default.reservation.create({
            data: { memberId: member.id, bookId, queuePosition: queueCount + 1, status: 'ACTIVE' },
            include: { book: { select: { title: true } } },
        });
        return (0, response_1.sendSuccess)(res, reservation, `Reservation placed. Queue position: ${reservation.queuePosition}`, 201);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reservations
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const where = {};
        if (req.user.role === client_1.Role.MEMBER) {
            const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
            if (!member)
                return (0, response_1.sendError)(res, 'Member not found', 404);
            where.memberId = member.id;
        }
        else {
            if (req.query.status)
                where.status = req.query.status;
        }
        const [total, reservations] = await Promise.all([
            prisma_1.default.reservation.count({ where }),
            prisma_1.default.reservation.findMany({
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
        return (0, response_1.sendPaginated)(res, reservations, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/reservations/:id  — MEMBER cancels
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.MEMBER), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const member = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
        const reservation = await prisma_1.default.reservation.findUnique({ where: { id } });
        if (!reservation || reservation.memberId !== member?.id)
            return (0, response_1.sendError)(res, 'Reservation not found', 404);
        if (reservation.status !== 'ACTIVE')
            return (0, response_1.sendError)(res, 'Only active reservations can be cancelled', 409);
        await prisma_1.default.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
        return (0, response_1.sendSuccess)(res, null, 'Reservation cancelled');
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=reservations.js.map