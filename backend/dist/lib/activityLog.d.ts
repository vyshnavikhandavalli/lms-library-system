import { Prisma } from '@prisma/client';
export declare function logActivity(actorId: number, action: string, entityType: string, entityId?: number, details?: Record<string, unknown>, ipAddress?: string): Promise<{
    action: string;
    entityType: string;
    entityId: number | null;
    details: Prisma.JsonValue | null;
    ipAddress: string | null;
    createdAt: Date;
    id: number;
    actorId: number;
}>;
//# sourceMappingURL=activityLog.d.ts.map