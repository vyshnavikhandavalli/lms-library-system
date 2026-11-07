import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError } from '../lib/response';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

router.get('/', authenticate, async (_req, res: Response, next: NextFunction) => {
  try {
    const cats = await prisma.bookCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { books: true } } },
    });
    return sendSuccess(res, cats);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = categorySchema.parse(req.body);
    const cat = await prisma.bookCategory.create({ data });
    return sendSuccess(res, cat, 'Category created', 201);
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const cat = await prisma.bookCategory.update({ where: { id: parseInt(req.params.id) }, data });
    return sendSuccess(res, cat, 'Category updated');
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const bookCount = await prisma.book.count({ where: { categoryId: id } });
    if (bookCount > 0) return sendError(res, 'Cannot delete category with existing books', 409);
    await prisma.bookCategory.delete({ where: { id } });
    return sendSuccess(res, null, 'Category deleted');
  } catch (err) { next(err); }
});

export default router;
