import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { AuthRequest } from '../types';
import { Role, MemberStatus } from '@prisma/client';
import { logActivity } from '../lib/activityLog';

const router = Router();

const createMemberSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  address: z.string().optional(),
  maxBooksAllowed: z.number().int().min(1).max(10).optional(),
});

const updateMemberSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.nativeEnum(MemberStatus).optional(),
  maxBooksAllowed: z.number().int().min(1).max(10).optional(),
});

// GET /api/members
router.get('/', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const status = req.query.status as MemberStatus | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { memberCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, members] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
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

    return sendPaginated(res, members, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/members/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    // Members can only view themselves
    if (req.user!.role === Role.MEMBER) {
      const own = await prisma.member.findUnique({ where: { userId: req.user!.userId } });
      if (!own || own.id !== id) return sendError(res, 'Access denied', 403);
    }

    const member = await prisma.member.findUnique({
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
    if (!member) return sendError(res, 'Member not found', 404);
    return sendSuccess(res, member);
  } catch (err) { next(err); }
});

// POST /api/members  — admin/librarian creates a member
router.post('/', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createMemberSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return sendError(res, 'Email already registered', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const count = await prisma.member.count();
    const memberCode = `MEM${String(count + 1).padStart(4, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, passwordHash, role: Role.MEMBER },
      });
      const member = await tx.member.create({
        data: {
          userId: user.id, memberCode, phone: data.phone, address: data.address,
          maxBooksAllowed: data.maxBooksAllowed ?? 3, status: MemberStatus.ACTIVE,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return member;
    });

    await logActivity(req.user!.userId, 'CREATE_MEMBER', 'member', result.id, { memberCode });
    return sendSuccess(res, result, 'Member created successfully', 201);
  } catch (err) { next(err); }
});

// PUT /api/members/:id
router.put('/:id', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const data = updateMemberSchema.parse(req.body);

    const member = await prisma.member.findUnique({ where: { id }, include: { user: true } });
    if (!member) return sendError(res, 'Member not found', 404);

    const updatedMember = await prisma.member.update({
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

    await logActivity(req.user!.userId, 'UPDATE_MEMBER', 'member', id, { changes: data });
    return sendSuccess(res, updatedMember, 'Member updated successfully');
  } catch (err) { next(err); }
});

// GET /api/members/:id/loans
router.get('/:id/loans', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const [total, loans] = await Promise.all([
      prisma.loan.count({ where: { memberId: id } }),
      prisma.loan.findMany({
        where: { memberId: id },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: { bookCopy: { include: { book: { include: { category: true } } } } },
      }),
    ]);

    return sendPaginated(res, loans, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/members/:id/fines
router.get('/:id/fines', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const fines = await prisma.fine.findMany({
      where: { memberId: parseInt(req.params.id) },
      orderBy: { generatedAt: 'desc' },
      include: { loan: { include: { bookCopy: { include: { book: true } } } }, payments: true },
    });
    return sendSuccess(res, fines);
  } catch (err) { next(err); }
});

export default router;
