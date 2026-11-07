import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { sendError } from '../lib/response';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return sendError(res, 'Authentication required', 401);
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Access denied: insufficient permissions', 403);
    }
    next();
  };
}
