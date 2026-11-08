"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
exports.sendPaginated = sendPaginated;
function sendSuccess(res, data, message, status = 200) {
    const body = { success: true, data, message };
    return res.status(status).json(body);
}
function sendError(res, error, status = 400) {
    const body = { success: false, error };
    return res.status(status).json(body);
}
function sendPaginated(res, data, total, page, limit) {
    const body = {
        success: true,
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
    return res.status(200).json(body);
}
//# sourceMappingURL=response.js.map