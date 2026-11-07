# Library Management System (LMS)

A complete full-stack Library Management System for educational institutions built with:

- **Backend**: Node.js + Express + TypeScript + Prisma ORM + PostgreSQL
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + TanStack Query

---

## Features

| Module | Description |
|---|---|
| Role-based Auth | Admin, Librarian, Member — JWT access + refresh tokens |
| Book Catalog | Add/edit/delete books, manage physical copies |
| Member Management | Register, edit, suspend members |
| Borrow Workflow | Request → Approve → Issue → Return |
| Fine Management | Auto overdue detection, daily fine rate, payment recording |
| Reservations | Queue-based reservations with expiry and notifications |
| Notifications | In-app notification system for all events |
| Dashboards | Role-specific dashboards with live DB stats |
| Reports | Borrowing trends, popular books, overdue summary |
| Settings | Configurable loan duration, fine rates, borrow limits |

---

## Prerequisites

- Node.js v18+
- PostgreSQL 14+ (running locally or remote)
- npm

---

## Setup Instructions

### 1. Clone / open the project

```
lms/
├── backend/
└── frontend/
```

---

### 2. Set up PostgreSQL

Create a database:

```sql
CREATE DATABASE lms_db;
```

---

### 3. Configure the backend environment

Edit `lms/backend/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/lms_db?schema=public"
JWT_SECRET="your_secure_secret_here"
JWT_REFRESH_SECRET="your_refresh_secret_here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=5001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3001"
```

Replace `YOUR_PASSWORD` with your PostgreSQL password.

---

### 4. Run database migrations and seed

```bash
cd lms/backend
npx prisma migrate dev --name init
npm run db:seed
```

This creates all tables and seeds:
- Admin: `admin@library.edu` / `Admin@123`
- Librarian: `librarian@library.edu` / `Librarian@123`
- Members: `alice@student.edu` / `Member@123` (and 4 more)
- 10 books across 10 categories
- All library settings

---

### 5. Start the backend

```bash
cd lms/backend
npm run dev
```

API runs at: **http://localhost:5001**

---

### 6. Start the frontend

Open a second terminal:

```bash
cd lms/frontend
npm run dev
```

App runs at: **http://localhost:3001**

---

## Usage

Open **http://localhost:3001** and use the quick-login buttons or enter credentials manually.

### Role Workflows

#### Admin
- Manage all books, categories, members
- View all loans and fines
- Configure library settings (fine rate, loan duration, etc.)
- View reports and analytics

#### Librarian
- Dashboard shows today's activity and pending items
- Approve or reject borrow requests
- Issue books to members (after approval)
- Process returns and record book condition
- Manage overdue tracking and fine payments

#### Member
- Browse and search the full catalog
- Submit borrow requests
- Reserve unavailable books
- Track active loans, due dates, overdue status
- View and track outstanding fines
- Receive in-app notifications for all events

---

## API Reference

Base URL: `http://localhost:5001/api`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /auth/register | Public | Self-register as member |
| POST | /auth/login | Public | Login, returns JWT |
| POST | /auth/refresh | Public | Refresh access token |
| GET | /auth/me | Any | Current user profile |
| GET | /books | Any | List/search books |
| POST | /books | Admin/Lib | Add book |
| PUT | /books/:id | Admin/Lib | Update book |
| DELETE | /books/:id | Admin | Delete book |
| GET | /categories | Any | List categories |
| GET | /members | Admin/Lib | List members |
| POST | /members | Admin/Lib | Create member |
| PUT | /members/:id | Admin/Lib | Update member |
| POST | /borrow-requests | Member | Submit borrow request |
| GET | /borrow-requests | Any | List requests |
| PATCH | /borrow-requests/:id/approve | Admin/Lib | Approve request |
| PATCH | /borrow-requests/:id/reject | Admin/Lib | Reject request |
| POST | /loans/issue | Admin/Lib | Issue book |
| POST | /loans/:id/return | Admin/Lib | Process return |
| GET | /loans/my | Member | Member's own loans |
| GET | /fines | Admin/Lib | All fines |
| POST | /fines/:id/payments | Admin/Lib | Record fine payment |
| POST | /reservations | Member | Reserve a book |
| DELETE | /reservations/:id | Member | Cancel reservation |
| GET | /notifications | Any | Own notifications |
| GET | /dashboard/admin | Admin | Admin stats |
| GET | /dashboard/librarian | Admin/Lib | Librarian stats |
| GET | /dashboard/member | Member | Member dashboard |
| GET | /settings | Admin | Library settings |
| PUT | /settings/:key | Admin | Update setting |
| GET | /reports/borrowing-trends | Admin/Lib | Monthly trends |
| GET | /reports/popular-books | Admin/Lib | Top borrowed books |
| GET | /reports/overdue-summary | Admin/Lib | All overdue loans |

---

## Project Structure

```
lms/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Full DB schema
│   └── src/
│       ├── server.ts             # App entry point
│       ├── lib/                  # Prisma, JWT, notifications, logger
│       ├── middleware/           # auth, error handler
│       ├── routes/               # All API routes
│       │   ├── auth.ts
│       │   ├── books.ts
│       │   ├── categories.ts
│       │   ├── members.ts
│       │   ├── borrowRequests.ts
│       │   ├── loans.ts
│       │   ├── fines.ts
│       │   ├── reservations.ts
│       │   ├── notifications.ts
│       │   ├── dashboard.ts
│       │   ├── settings.ts
│       │   └── reports.ts
│       ├── prisma/
│       │   └── seed.ts           # Seed data
│       └── types/                # TypeScript types
└── frontend/
    └── src/
        ├── App.tsx               # Router + role guards
        ├── contexts/             # AuthContext
        ├── layouts/              # Admin, Librarian, Member layouts
        ├── lib/                  # Axios API client
        ├── components/           # Shared UI components
        └── pages/
            ├── auth/             # Login, Register
            ├── admin/            # 8 admin pages
            ├── librarian/        # 7 librarian pages
            └── member/           # 6 member pages
```

---

## Default Library Settings

| Setting | Default | Description |
|---|---|---|
| loan_duration_days | 14 | Days before a loan is due |
| fine_per_day | ₹5 | Daily fine for overdue books |
| max_books_per_member | 3 | Borrowing limit per member |
| reservation_expiry_days | 3 | Days to collect after reservation notification |
| max_renewals | 2 | Maximum loan renewals |

All configurable from Admin → Settings.
