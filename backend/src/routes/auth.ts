import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { sendSuccess, sendError } from '../lib/response';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { Role, MemberStatus } from '@prisma/client';
import { logActivity } from '../lib/activityLog';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts' });

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase and a number'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register  (self-registration as MEMBER)
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return sendError(res, 'Email already registered', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, passwordHash, role: Role.MEMBER },
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
          status: MemberStatus.ACTIVE,
        },
      });

      return { user, member };
    });

    const accessToken = signAccessToken({ userId: result.user.id, role: result.user.role, email: result.user.email });
    const refreshToken = signRefreshToken({ userId: result.user.id, role: result.user.role, email: result.user.email });

    return sendSuccess(res, {
      accessToken, refreshToken,
      user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
    }, 'Registration successful', 201);
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return sendError(res, 'Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return sendError(res, 'Invalid credentials', 401);

    const payload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await logActivity(user.id, 'LOGIN', 'user', user.id, { email });

    return sendSuccess(res, {
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, 'Login successful');
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 'Refresh token required', 400);
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) return sendError(res, 'Invalid refresh token', 401);
    const newAccessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email });
    return sendSuccess(res, { accessToken: newAccessToken });
  } catch {
    return sendError(res, 'Invalid or expired refresh token', 401);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user) await logActivity(req.user.userId, 'LOGOUT', 'user', req.user.userId);
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
        member: {
          select: { id: true, memberCode: true, phone: true, address: true, maxBooksAllowed: true, status: true, joinedDate: true }
        },
      },
    });
    if (!user) return sendError(res, 'User not found', 404);
    return sendSuccess(res, user);
  } catch (err) { next(err); }
});

export default router;
