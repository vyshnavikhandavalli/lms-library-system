import { AuthPayload } from '../types';
export declare function signAccessToken(payload: AuthPayload): string;
export declare function signRefreshToken(payload: AuthPayload): string;
export declare function verifyAccessToken(token: string): AuthPayload;
export declare function verifyRefreshToken(token: string): AuthPayload;
//# sourceMappingURL=jwt.d.ts.map