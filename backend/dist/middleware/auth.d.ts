import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { Role } from '@prisma/client';
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function authorize(...roles: Role[]): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map