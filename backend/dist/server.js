"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const errorHandler_1 = require("./middleware/errorHandler");
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const books_1 = __importDefault(require("./routes/books"));
const categories_1 = __importDefault(require("./routes/categories"));
const members_1 = __importDefault(require("./routes/members"));
const borrowRequests_1 = __importDefault(require("./routes/borrowRequests"));
const loans_1 = __importDefault(require("./routes/loans"));
const fines_1 = __importDefault(require("./routes/fines"));
const reservations_1 = __importDefault(require("./routes/reservations"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const settings_1 = __importDefault(require("./routes/settings"));
const reports_1 = __importDefault(require("./routes/reports"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3001',
    'http://localhost:3000',
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', auth_1.default);
app.use('/api/books', books_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/members', members_1.default);
app.use('/api/borrow-requests', borrowRequests_1.default);
app.use('/api/loans', loans_1.default);
app.use('/api/fines', fines_1.default);
app.use('/api/reservations', reservations_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/reports', reports_1.default);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));
// ── Error handler (must be last) ──────────────────────────────
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`\n🚀 LMS API running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV}`);
});
//# sourceMappingURL=server.js.map