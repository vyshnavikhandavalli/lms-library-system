import { NotificationType } from '@prisma/client';
export declare function createNotification(userId: number, type: NotificationType, title: string, message: string): Promise<{
    createdAt: Date;
    id: number;
    message: string;
    type: import(".prisma/client").$Enums.NotificationType;
    userId: number;
    title: string;
    isRead: boolean;
}>;
//# sourceMappingURL=notifications.d.ts.map