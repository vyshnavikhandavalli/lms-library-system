import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRouter from './routes/auth';
import booksRouter from './routes/books';
import categoriesRouter from './routes/categories';
import membersRouter from './routes/members';
import borrowRequestsRouter from './routes/borrowRequests';
import loansRouter from './routes/loans';
import finesRouter from './routes/fines';
import reservationsRouter from './routes/reservations';
import notificationsRouter from './routes/notifications';
import dashboardRouter from './routes/dashboard';
import settingsRouter from './routes/settings';
import reportsRouter from './routes/reports';

const app = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ────────────────────────────────────────────
// Allow multiple origins — local dev + production frontend
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3001',
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/members', membersRouter);
app.use('/api/borrow-requests', borrowRequestsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/fines', finesRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Error handler (must be last) ──────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 LMS API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
});
