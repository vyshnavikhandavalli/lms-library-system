import prisma from './prisma';
import { NotificationType } from '@prisma/client';

export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string
) {
  return prisma.notification.create({
    data: { userId, type, title, message },
  });
}
