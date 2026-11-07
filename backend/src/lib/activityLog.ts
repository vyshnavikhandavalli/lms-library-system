import prisma from './prisma';
import { Prisma } from '@prisma/client';

export async function logActivity(
  actorId: number,
  action: string,
  entityType: string,
  entityId?: number,
  details?: Record<string, unknown>,
  ipAddress?: string
) {
  return prisma.activityLog.create({
    data: {
      actorId, action, entityType, entityId, ipAddress,
      details: details as Prisma.InputJsonValue | undefined,
    },
  });
}
