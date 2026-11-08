"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const jwt_1 = require("../lib/jwt");
const response_1 = require("../lib/response");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return (0, response_1.sendError)(res, 'Authentication required', 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        req.user = (0, jwt_1.verifyAccessToken)(token);
        next();
    }
    catch {
        return (0, response_1.sendError)(res, 'Invalid or expired token', 401);
    }
}
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return (0, response_1.sendError)(res, 'Authentication required', 401);
        if (!roles.includes(req.user.role)) {
            return (0, response_1.sendError)(res, 'Access denied: insufficient permissions', 403);
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map