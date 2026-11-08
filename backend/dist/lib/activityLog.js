"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const prisma_1 = __importDefault(require("./prisma"));
async function logActivity(actorId, action, entityType, entityId, details, ipAddress) {
    return prisma_1.default.activityLog.create({
        data: {
            actorId, action, entityType, entityId, ipAddress,
            details: details,
        },
    });
}
//# sourceMappingURL=activityLog.js.map