"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const response_1 = require("../lib/response");
const client_1 = require("@prisma/client");
const activityLog_1 = require("../lib/activityLog");
const router = (0, express_1.Router)();
const createMemberSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    maxBooksAllowed: zod_1.z.number().int().min(1).max(10).optional(),
});
const updateMemberSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100).optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(client_1.MemberStatus).optional(),
    maxBooksAllowed: zod_1.z.number().int().min(1).max(10).optional(),
});
// GET /api/members
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status;
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { memberCode: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [total, members] = await Promise.all([
            prisma_1.default.member.count({ where }),
            prisma_1.default.member.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { joinedDate: 'desc' },
                include: {
                    user: { select: { id: true, name: true, email: true, isActive: true } },
                    _count: { select: { loans: true, fines: true } },
                },
            }),
        ]);
        return (0, response_1.sendPaginated)(res, members, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/members/:id
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        // Members can only view themselves
        if (req.user.role === client_1.Role.MEMBER) {
            const own = await prisma_1.default.member.findUnique({ where: { userId: req.user.userId } });
            if (!own || own.id !== id)
                return (0, response_1.sendError)(res, 'Access denied', 403);
        }
        const member = await prisma_1.default.member.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true, isActive: true, createdAt: true } },
                loans: {
                    take: 10,
                    orderBy: { issueDate: 'desc' },
                    include: { bookCopy: { include: { book: { select: { title: true, isbn: true, author: true } } } } },
                },
                fines: { where: { isPaid: false }, select: { id: true, amount: true, fineType: true, generatedAt: true } },
                _count: { select: { loans: true, reservations: true } },
            },
        });
        if (!member)
            return (0, response_1.sendError)(res, 'Member not found', 404);
        return (0, response_1.sendSuccess)(res, member);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/members  — admin/librarian creates a member
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const data = createMemberSchema.parse(req.body);
        const existing = await prisma_1.default.user.findUnique({ where: { email: data.email } });
        if (existing)
            return (0, response_1.sendError)(res, 'Email already registered', 409);
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const count = await prisma_1.default.member.count();
        const memberCode = `MEM${String(count + 1).padStart(4, '0')}`;
        const result = await prisma_1.default.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { name: data.name, email: data.email, passwordHash, role: client_1.Role.MEMBER },
            });
            const member = await tx.member.create({
                data: {
                    userId: user.id, memberCode, phone: data.phone, address: data.address,
                    maxBooksAllowed: data.maxBooksAllowed ?? 3, status: client_1.MemberStatus.ACTIVE,
                },
                include: { user: { select: { id: true, name: true, email: true } } },
            });
            return member;
        });
        await (0, activityLog_1.logActivity)(req.user.userId, 'CREATE_MEMBER', 'member', result.id, { memberCode });
        return (0, response_1.sendSuccess)(res, result, 'Member created successfully', 201);
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/members/:id
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const data = updateMemberSchema.parse(req.body);
        const member = await prisma_1.default.member.findUnique({ where: { id }, include: { user: true } });
        if (!member)
            return (0, response_1.sendError)(res, 'Member not found', 404);
        const updatedMember = await prisma_1.default.member.update({
            where: { id },
            data: {
                phone: data.phone,
                address: data.address,
                status: data.status,
                maxBooksAllowed: data.maxBooksAllowed,
                user: data.name ? { update: { name: data.name } } : undefined,
            },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        await (0, activityLog_1.logActivity)(req.user.userId, 'UPDATE_MEMBER', 'member', id, { changes: data });
        return (0, response_1.sendSuccess)(res, updatedMember, 'Member updated successfully');
    }
    catch (err) {
        next(err);
    }
});
// GET /api/members/:id/loans
router.get('/:id/loans', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const [total, loans] = await Promise.all([
            prisma_1.default.loan.count({ where: { memberId: id } }),
            prisma_1.default.loan.findMany({
                where: { memberId: id },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { issueDate: 'desc' },
                include: { bookCopy: { include: { book: { include: { category: true } } } } },
            }),
        ]);
        return (0, response_1.sendPaginated)(res, loans, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/members/:id/fines
router.get('/:id/fines', auth_1.authenticate, async (req, res, next) => {
    try {
        const fines = await prisma_1.default.fine.findMany({
            where: { memberId: parseInt(req.params.id) },
            orderBy: { generatedAt: 'desc' },
            include: { loan: { include: { bookCopy: { include: { book: true } } } }, payments: true },
        });
        return (0, response_1.sendSuccess)(res, fines);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=members.js.map