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
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().optional(),
});
router.get('/', auth_1.authenticate, async (_req, res, next) => {
    try {
        const cats = await prisma_1.default.bookCategory.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { books: true } } },
        });
        return (0, response_1.sendSuccess)(res, cats);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const data = categorySchema.parse(req.body);
        const cat = await prisma_1.default.bookCategory.create({ data });
        return (0, response_1.sendSuccess)(res, cat, 'Category created', 201);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const data = categorySchema.partial().parse(req.body);
        const cat = await prisma_1.default.bookCategory.update({ where: { id: parseInt(req.params.id) }, data });
        return (0, response_1.sendSuccess)(res, cat, 'Category updated');
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const bookCount = await prisma_1.default.book.count({ where: { categoryId: id } });
        if (bookCount > 0)
            return (0, response_1.sendError)(res, 'Cannot delete category with existing books', 409);
        await prisma_1.default.bookCategory.delete({ where: { id } });
        return (0, response_1.sendSuccess)(res, null, 'Category deleted');
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=categories.js.map