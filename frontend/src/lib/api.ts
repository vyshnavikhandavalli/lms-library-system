import axios from 'axios';

// In production (Vercel), VITE_API_URL points to the Render backend.
// In development, Vite proxies /api → localhost:5001, so baseURL = /api.
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export const api = axios.create({ baseURL: BASE_URL });

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — clear session and redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────
export const authApi = {
  register: (d: unknown) => api.post('/auth/register', d).then(r => r.data),
  login: (d: unknown) => api.post('/auth/login', d).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
};

// ── Books ────────────────────────────────────────────────
export const booksApi = {
  list: (params?: Record<string, unknown>) => api.get('/books', { params }).then(r => r.data),
  get: (id: number) => api.get(`/books/${id}`).then(r => r.data),
  create: (d: unknown) => api.post('/books', d).then(r => r.data),
  update: (id: number, d: unknown) => api.put(`/books/${id}`, d).then(r => r.data),
  delete: (id: number) => api.delete(`/books/${id}`).then(r => r.data),
  copies: (id: number) => api.get(`/books/${id}/copies`).then(r => r.data),
};

// ── Categories ───────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories').then(r => r.data),
  create: (d: unknown) => api.post('/categories', d).then(r => r.data),
  update: (id: number, d: unknown) => api.put(`/categories/${id}`, d).then(r => r.data),
  delete: (id: number) => api.delete(`/categories/${id}`).then(r => r.data),
};

// ── Members ──────────────────────────────────────────────
export const membersApi = {
  list: (params?: Record<string, unknown>) => api.get('/members', { params }).then(r => r.data),
  get: (id: number) => api.get(`/members/${id}`).then(r => r.data),
  create: (d: unknown) => api.post('/members', d).then(r => r.data),
  update: (id: number, d: unknown) => api.put(`/members/${id}`, d).then(r => r.data),
  loans: (id: number, params?: Record<string, unknown>) => api.get(`/members/${id}/loans`, { params }).then(r => r.data),
  fines: (id: number) => api.get(`/members/${id}/fines`).then(r => r.data),
};

// ── Borrow Requests ──────────────────────────────────────
export const borrowRequestsApi = {
  list: (params?: Record<string, unknown>) => api.get('/borrow-requests', { params }).then(r => r.data),
  create: (d: unknown) => api.post('/borrow-requests', d).then(r => r.data),
  approve: (id: number) => api.patch(`/borrow-requests/${id}/approve`).then(r => r.data),
  reject: (id: number, d: unknown) => api.patch(`/borrow-requests/${id}/reject`, d).then(r => r.data),
  cancel: (id: number) => api.patch(`/borrow-requests/${id}/cancel`).then(r => r.data),
};

// ── Loans ────────────────────────────────────────────────
export const loansApi = {
  list: (params?: Record<string, unknown>) => api.get('/loans', { params }).then(r => r.data),
  my: (params?: Record<string, unknown>) => api.get('/loans/my', { params }).then(r => r.data),
  get: (id: number) => api.get(`/loans/${id}`).then(r => r.data),
  issue: (d: unknown) => api.post('/loans/issue', d).then(r => r.data),
  return: (id: number, d: unknown) => api.post(`/loans/${id}/return`, d).then(r => r.data),
};

// ── Fines ────────────────────────────────────────────────
export const finesApi = {
  list: (params?: Record<string, unknown>) => api.get('/fines', { params }).then(r => r.data),
  my: () => api.get('/fines/my').then(r => r.data),
  byMember: (memberId: number) => api.get(`/fines/member/${memberId}`).then(r => r.data),
  pay: (id: number, d: unknown) => api.post(`/fines/${id}/payments`, d).then(r => r.data),
};

// ── Reservations ─────────────────────────────────────────
export const reservationsApi = {
  list: (params?: Record<string, unknown>) => api.get('/reservations', { params }).then(r => r.data),
  create: (d: unknown) => api.post('/reservations', d).then(r => r.data),
  cancel: (id: number) => api.delete(`/reservations/${id}`).then(r => r.data),
};

// ── Notifications ────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/notifications').then(r => r.data),
  read: (id: number) => api.patch(`/notifications/${id}/read`).then(r => r.data),
  readAll: () => api.patch('/notifications/read-all').then(r => r.data),
};

// ── Dashboard ────────────────────────────────────────────
export const dashboardApi = {
  admin: () => api.get('/dashboard/admin').then(r => r.data),
  librarian: () => api.get('/dashboard/librarian').then(r => r.data),
  member: () => api.get('/dashboard/member').then(r => r.data),
};

// ── Settings ─────────────────────────────────────────────
export const settingsApi = {
  list: () => api.get('/settings').then(r => r.data),
  update: (key: string, value: string) => api.put(`/settings/${key}`, { value }).then(r => r.data),
};

// ── Reports ──────────────────────────────────────────────
export const reportsApi = {
  borrowingTrends: () => api.get('/reports/borrowing-trends').then(r => r.data),
  popularBooks: () => api.get('/reports/popular-books').then(r => r.data),
  overdueSummary: () => api.get('/reports/overdue-summary').then(r => r.data),
};
