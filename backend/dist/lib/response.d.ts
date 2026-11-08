import { Response } from 'express';
export declare function sendSuccess<T>(res: Response, data: T, message?: string, status?: number): Response<any, Record<string, any>>;
export declare function sendError(res: Response, error: string, status?: number): Response<any, Record<string, any>>;
export declare function sendPaginated<T>(res: Response, data: T[], total: number, page: number, limit: number): Response<any, Record<string, any>>;
//# sourceMappingURL=response.d.ts.map