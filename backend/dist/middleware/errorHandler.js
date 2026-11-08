"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
function errorHandler(err, req, res, _next) {
    console.error('[Error]', err);
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            return res.status(409).json({ success: false, error: 'A record with this value already exists' });
        }
        if (err.code === 'P2025') {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }
    }
    if (err instanceof Error) {
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
    return res.status(500).json({ success: false, error: 'Internal server error' });
}
//# sourceMappingURL=errorHandler.js.map