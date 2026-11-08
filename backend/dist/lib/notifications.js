"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
const prisma_1 = __importDefault(require("./prisma"));
async function createNotification(userId, type, title, message) {
    return prisma_1.default.notification.create({
        data: { userId, type, title, message },
    });
}
//# sourceMappingURL=notifications.js.map