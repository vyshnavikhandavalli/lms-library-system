import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess, sendError, sendPaginated } from '../lib/response';
import { AuthRequest } from '../types';
import { Role, CopyCondition, CopyStatus } from '@prisma/client';
import { logActivity } from '../lib/activityLog';

const router = Router();

const bookSchema = z.object({
  title: z.string().min(1).max(255),
  isbn: z.string().min(10).max(20),
  author: z.string().min(1).max(255),
  publisher: z.string().optional(),
  categoryId: z.number().int().positive(),
  publicationYear: z.number().int().min(1000).max(new Date().getFullYear() + 1).optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  totalCopies: z.number().int().min(1),
  shelfLocation: z.string().optional(),
});

// GET /api/books  — public search, all roles
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const availability = req.query.availability as string;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (availability === 'available') where.availableCopies = { gt: 0 };
    if (availability === 'unavailable') where.availableCopies = 0;

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
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

    return sendPaginated(res, books, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/books/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        category: true,
        copies: { orderBy: { copyCode: 'asc' } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { copies: true, borrowRequests: true } },
      },
    });
    if (!book) return sendError(res, 'Book not found', 404);
    return sendSuccess(res, book);
  } catch (err) { next(err); }
});

// POST /api/books
router.post('/', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = bookSchema.parse(req.body);
    const existing = await prisma.book.findUnique({ where: { isbn: data.isbn } });
    if (existing) return sendError(res, 'A book with this ISBN already exists', 409);

    const book = await prisma.$transaction(async (tx) => {
      const newBook = await tx.book.create({
        data: {
          ...data,
          availableCopies: data.totalCopies,
          createdById: req.user!.userId,
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
            condition: CopyCondition.GOOD,
            status: CopyStatus.AVAILABLE,
          },
        });
      }
      return newBook;
    });

    await logActivity(req.user!.userId, 'CREATE_BOOK', 'book', book.id, { title: book.title, isbn: book.isbn });
    return sendSuccess(res, book, 'Book added successfully', 201);
  } catch (err) { next(err); }
});

// PUT /api/books/:id
router.put('/:id', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const data = bookSchema.partial().parse(req.body);

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) return sendError(res, 'Book not found', 404);

    // Handle copy count change
    let updateData: Record<string, unknown> = { ...data };
    if (data.totalCopies !== undefined && data.totalCopies !== book.totalCopies) {
      const diff = data.totalCopies - book.totalCopies;
      const newAvailable = Math.max(0, book.availableCopies + diff);
      updateData.availableCopies = newAvailable;

      if (diff > 0) {
        // Add new copies
        const existing = await prisma.bookCopy.count({ where: { bookId: id } });
        for (let i = existing + 1; i <= existing + diff; i++) {
          const suffix = String(i).padStart(3, '0');
          await prisma.bookCopy.create({
            data: { bookId: id, copyCode: `${book.isbn}-${suffix}`, condition: CopyCondition.GOOD, status: CopyStatus.AVAILABLE },
          });
        }
      }
    }

    const updated = await prisma.book.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    await logActivity(req.user!.userId, 'UPDATE_BOOK', 'book', id, { changes: data });
    return sendSuccess(res, updated, 'Book updated successfully');
  } catch (err) { next(err); }
});

// DELETE /api/books/:id
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const activeLoans = await prisma.loan.count({
      where: { bookCopy: { bookId: id }, status: { in: ['ACTIVE', 'OVERDUE'] } },
    });
    if (activeLoans > 0) return sendError(res, 'Cannot delete book with active loans', 409);

    await prisma.book.delete({ where: { id } });
    await logActivity(req.user!.userId, 'DELETE_BOOK', 'book', id);
    return sendSuccess(res, null, 'Book deleted successfully');
  } catch (err) { next(err); }
});

// GET /api/books/:id/copies
router.get('/:id/copies', authenticate, authorize(Role.ADMIN, Role.LIBRARIAN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const copies = await prisma.bookCopy.findMany({
      where: { bookId: parseInt(req.params.id) },
      orderBy: { copyCode: 'asc' },
    });
    return sendSuccess(res, copies);
  } catch (err) { next(err); }
});

// GET /api/categories
router.get('/categories/all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.bookCategory.findMany({ orderBy: { name: 'asc' } });
    return sendSuccess(res, categories);
  } catch (err) { next(err); }
});

export default router;
