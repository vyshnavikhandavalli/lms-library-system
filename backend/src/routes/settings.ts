import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess } from '../lib/response';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authenticate, authorize(Role.ADMIN), async (_req, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.librarySetting.findMany({ orderBy: { key: 'asc' } });
    return sendSuccess(res, settings);
  } catch (err) { next(err); }
});

router.put('/:key', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { value } = z.object({ value: z.string().min(1) }).parse(req.body);
    const setting = await prisma.librarySetting.update({
      where: { key: req.params.key },
      data: { value, updatedById: req.user!.userId },
    });
    return sendSuccess(res, setting, 'Setting updated');
  } catch (err) { next(err); }
});

export default router;
