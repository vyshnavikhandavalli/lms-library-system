"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const jwt_1 = require("../lib/jwt");
const response_1 = require("../lib/response");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const activityLog_1 = require("../lib/activityLog");
const router = (0, express_1.Router)();
const loginLimiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts' });
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase and a number'),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
// POST /api/auth/register  (self-registration as MEMBER)
router.post('/register', async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);
        const existing = await prisma_1.default.user.findUnique({ where: { email: data.email } });
        if (existing)
            return (0, response_1.sendError)(res, 'Email already registered', 409);
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const result = await prisma_1.default.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { name: data.name, email: data.email, passwordHash, role: client_1.Role.MEMBER },
            });
            // Generate member code
            const count = await tx.member.count();
            const memberCode = `MEM${String(count + 1).padStart(4, '0')}`;
            const member = await tx.member.create({
                data: {
                    userId: user.id,
                    memberCode,
                    phone: data.phone,
                    address: data.address,
                    status: client_1.MemberStatus.ACTIVE,
                },
            });
            return { user, member };
        });
        const accessToken = (0, jwt_1.signAccessToken)({ userId: result.user.id, role: result.user.role, email: result.user.email });
        const refreshToken = (0, jwt_1.signRefreshToken)({ userId: result.user.id, role: result.user.role, email: result.user.email });
        return (0, response_1.sendSuccess)(res, {
            accessToken, refreshToken,
            user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
        }, 'Registration successful', 201);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user || !user.isActive)
            return (0, response_1.sendError)(res, 'Invalid credentials', 401);
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid)
            return (0, response_1.sendError)(res, 'Invalid credentials', 401);
        const payload = { userId: user.id, role: user.role, email: user.email };
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        await (0, activityLog_1.logActivity)(user.id, 'LOGIN', 'user', user.id, { email });
        return (0, response_1.sendSuccess)(res, {
            accessToken, refreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        }, 'Login successful');
    }
    catch (err) {
        next(err);
    }
});
// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken)
            return (0, response_1.sendError)(res, 'Refresh token required', 400);
        const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const user = await prisma_1.default.user.findUnique({ where: { id: payload.userId } });
        if (!user || !user.isActive)
            return (0, response_1.sendError)(res, 'Invalid refresh token', 401);
        const newAccessToken = (0, jwt_1.signAccessToken)({ userId: user.id, role: user.role, email: user.email });
        return (0, response_1.sendSuccess)(res, { accessToken: newAccessToken });
    }
    catch {
        return (0, response_1.sendError)(res, 'Invalid or expired refresh token', 401);
    }
});
// POST /api/auth/logout
router.post('/logout', auth_1.authenticate, async (req, res, next) => {
    try {
        if (req.user)
            await (0, activityLog_1.logActivity)(req.user.userId, 'LOGOUT', 'user', req.user.userId);
        return (0, response_1.sendSuccess)(res, null, 'Logged out successfully');
    }
    catch (err) {
        next(err);
    }
});
// GET /api/auth/me
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
                member: {
                    select: { id: true, memberCode: true, phone: true, address: true, maxBooksAllowed: true, status: true, joinedDate: true }
                },
            },
        });
        if (!user)
            return (0, response_1.sendError)(res, 'User not found', 404);
        return (0, response_1.sendSuccess)(res, user);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map