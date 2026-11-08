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
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), async (_req, res, next) => {
    try {
        const settings = await prisma_1.default.librarySetting.findMany({ orderBy: { key: 'asc' } });
        return (0, response_1.sendSuccess)(res, settings);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:key', auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const { value } = zod_1.z.object({ value: zod_1.z.string().min(1) }).parse(req.body);
        const setting = await prisma_1.default.librarySetting.update({
            where: { key: req.params.key },
            data: { value, updatedById: req.user.userId },
        });
        return (0, response_1.sendSuccess)(res, setting, 'Setting updated');
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map