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
const activityLog_1 = require("../lib/activityLog");
const router = (0, express_1.Router)();
const bookSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    isbn: zod_1.z.string().min(10).max(20),
    author: zod_1.z.string().min(1).max(255),
    publisher: zod_1.z.string().optional(),
    categoryId: zod_1.z.number().int().positive(),
    publicationYear: zod_1.z.number().int().min(1000).max(new Date().getFullYear() + 1).optional(),
    description: zod_1.z.string().optional(),
    coverImageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    totalCopies: zod_1.z.number().int().min(1),
    shelfLocation: zod_1.z.string().optional(),
});
// GET /api/books  — public search, all roles
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
        const availability = req.query.availability;
        const where = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { contains: search, mode: 'insensitive' } },
                { isbn: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categoryId)
            where.categoryId = categoryId;
        if (availability === 'available')
            where.availableCopies = { gt: 0 };
        if (availability === 'unavailable')
            where.availableCopies = 0;
        const [total, books] = await Promise.all([
            prisma_1.default.book.count({ where }),
            prisma_1.default.book.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { title: 'asc' },
                include: {
                    category: { select: { id: true, name: true } },
                    _count: { select: { copies: true } },
                },
            }),
        ]);
        return (0, response_1.sendPaginated)(res, books, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/books/:id
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const book = await prisma_1.default.book.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                category: true,
                copies: { orderBy: { copyCode: 'asc' } },
                createdBy: { select: { id: true, name: true } },
                _count: { select: { copies: true, borrowRequests: true } },
            },
        });
        if (!book)
            return (0, response_1.sendError)(res, 'Book not found', 404);
        return (0, response_1.sendSuccess)(res, book);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/books
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const data = bookSchema.parse(req.body);
        const existing = await prisma_1.default.book.findUnique({ where: { isbn: data.isbn } });
        if (existing)
            return (0, response_1.sendError)(res, 'A book with this ISBN already exists', 409);
        const book = await prisma_1.default.$transaction(async (tx) => {
            const newBook = await tx.book.create({
                data: {
                    ...data,
                    availableCopies: data.totalCopies,
                    createdById: req.user.userId,
                    coverImageUrl: data.coverImageUrl || null,
                },
                include: { category: true },
            });
            // Create physical copies
            for (let i = 1; i <= data.totalCopies; i++) {
                const suffix = String(i).padStart(3, '0');
                await tx.bookCopy.create({
                    data: {
                        bookId: newBook.id,
                        copyCode: `${data.isbn}-${suffix}`,
                        condition: client_1.CopyCondition.GOOD,
                        status: client_1.CopyStatus.AVAILABLE,
                    },
                });
            }
            return newBook;
        });
        await (0, activityLog_1.logActivity)(req.user.userId, 'CREATE_BOOK', 'book', book.id, { title: book.title, isbn: book.isbn });
        return (0, response_1.sendSuccess)(res, book, 'Book added successfully', 201);
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/books/:id
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const data = bookSchema.partial().parse(req.body);
        const book = await prisma_1.default.book.findUnique({ where: { id } });
        if (!book)
            return (0, response_1.sendError)(res, 'Book not found', 404);
        // Handle copy count change
        let updateData = { ...data };
        if (data.totalCopies !== undefined && data.totalCopies !== book.totalCopies) {
            const diff = data.totalCopies - book.totalCopies;
            const newAvailable = Math.max(0, book.availableCopies + diff);
            updateData.availableCopies = newAvailable;
            if (diff > 0) {
                // Add new copies
                const existing = await prisma_1.default.bookCopy.count({ where: { bookId: id } });
                for (let i = existing + 1; i <= existing + diff; i++) {
                    const suffix = String(i).padStart(3, '0');
                    await prisma_1.default.bookCopy.create({
                        data: { bookId: id, copyCode: `${book.isbn}-${suffix}`, condition: client_1.CopyCondition.GOOD, status: client_1.CopyStatus.AVAILABLE },
                    });
                }
            }
        }
        const updated = await prisma_1.default.book.update({
            where: { id },
            data: updateData,
            include: { category: true },
        });
        await (0, activityLog_1.logActivity)(req.user.userId, 'UPDATE_BOOK', 'book', id, { changes: data });
        return (0, response_1.sendSuccess)(res, updated, 'Book updated successfully');
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/books/:id
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const activeLoans = await prisma_1.default.loan.count({
            where: { bookCopy: { bookId: id }, status: { in: ['ACTIVE', 'OVERDUE'] } },
        });
        if (activeLoans > 0)
            return (0, response_1.sendError)(res, 'Cannot delete book with active loans', 409);
        await prisma_1.default.book.delete({ where: { id } });
        await (0, activityLog_1.logActivity)(req.user.userId, 'DELETE_BOOK', 'book', id);
        return (0, response_1.sendSuccess)(res, null, 'Book deleted successfully');
    }
    catch (err) {
        next(err);
    }
});
// GET /api/books/:id/copies
router.get('/:id/copies', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN, client_1.Role.LIBRARIAN), async (req, res, next) => {
    try {
        const copies = await prisma_1.default.bookCopy.findMany({
            where: { bookId: parseInt(req.params.id) },
            orderBy: { copyCode: 'asc' },
        });
        return (0, response_1.sendSuccess)(res, copies);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/categories
router.get('/categories/all', auth_1.authenticate, async (req, res, next) => {
    try {
        const categories = await prisma_1.default.bookCategory.findMany({ orderBy: { name: 'asc' } });
        return (0, response_1.sendSuccess)(res, categories);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=books.js.map