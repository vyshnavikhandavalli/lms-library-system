# LMS Deployment Guide

## Stack
- **Database** → Neon (free PostgreSQL cloud)
- **Backend**  → Render (free Node.js hosting)
- **Frontend** → Vercel (free React hosting)

---

## STEP 1 — Push Code to GitHub

### 1a. Create a GitHub repository

1. Go to https://github.com → click **New repository**
2. Name it: `library-management-system`
3. Set to **Public** or **Private**
4. Do NOT add README or .gitignore (we already have them)
5. Click **Create repository**

### 1b. Push from your machine

Open terminal in the `lms` folder and run:

```bash
cd lms
git init
git add .
git commit -m "Initial commit — LMS full stack"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/library-management-system.git
git push -u origin main
```

---

## STEP 2 — Set Up Neon Database (Free PostgreSQL)

1. Go to **https://neon.tech** → Sign Up (free, no credit card)
2. Click **New Project**
   - Project name: `lms-db`
   - Region: choose closest to you (e.g. Asia Pacific - Singapore)
3. After creation, click **Dashboard**
4. Under **Connection Details**, select **Connection string**
5. Copy the string — looks like:
   ```
   postgresql://neondb_owner:AbCdEf@ep-cool-fog-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
6. **Save this string** — you need it in Step 3

---

## STEP 3 — Deploy Backend to Render

1. Go to **https://render.com** → Sign Up with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub repository `library-management-system`
4. Configure the service:

   | Field | Value |
   |---|---|
   | Name | `lms-backend` |
   | Root Directory | `backend` |
   | Runtime | `Node` |
   | Build Command | `npm install && npm run build && npx prisma migrate deploy` |
   | Start Command | `npm start` |
   | Instance Type | Free |

5. Click **Add Environment Variables** and add these one by one:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon connection string from Step 2 |
   | `JWT_SECRET` | Any long random string e.g. `x7k2mP9qL4nR8wZ3vB6yH1jF5sA0cE` |
   | `JWT_REFRESH_SECRET` | Another long random string e.g. `m3nQ8pT1aW6xK4rV9bG2uL5hD0yJ7f` |
   | `JWT_EXPIRES_IN` | `15m` |
   | `JWT_REFRESH_EXPIRES_IN` | `7d` |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | `https://lms-app.vercel.app` ← update after Step 4 |

6. Click **Create Web Service**
7. Wait 3–5 minutes for the build to finish
8. You will see a URL like: `https://lms-backend.onrender.com`
9. Test it: open `https://lms-backend.onrender.com/api/health` in browser
   - You should see: `{"status":"ok"}`

### Run the seed data on Render

After first deploy, go to Render → your service → **Shell** tab and run:

```bash
npx ts-node src/prisma/seed.ts
```

This creates Admin, Librarian, Members, Books and Settings in the cloud database.

---

## STEP 4 — Deploy Frontend to Vercel

1. Go to **https://vercel.com** → Sign Up with GitHub
2. Click **Add New Project**
3. Import your `library-management-system` repository
4. Configure the project:

   | Field | Value |
   |---|---|
   | Framework Preset | Vite |
   | Root Directory | `frontend` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

5. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://lms-backend.onrender.com` |

6. Click **Deploy**
7. Wait 2–3 minutes
8. Your app is live at: `https://lms-app.vercel.app` (or similar)

---

## STEP 5 — Update CORS on Backend

After you get your Vercel URL, go back to Render:

1. Go to your `lms-backend` service → **Environment**
2. Update `FRONTEND_URL` to your actual Vercel URL:
   ```
   https://your-actual-app.vercel.app
   ```
3. Click **Save Changes** — Render will redeploy automatically

---

## STEP 6 — Verify Deployment

Open your Vercel URL in browser.

Test login with:
- Admin: `admin@library.edu` / `Admin@123`
- Librarian: `librarian@library.edu` / `Librarian@123`
- Member: `alice@student.edu` / `Member@123`

---

## Deployment Diagram

```
GitHub Repository
      │
      ├──── backend/ ──────→  Render Web Service
      │                          │
      │                          └── connects to ──→  Neon PostgreSQL
      │
      └──── frontend/ ─────→  Vercel
                                  │
                                  └── calls API ──→  Render Backend
```

---

## Free Tier Limits

| Service | Free Limit | Notes |
|---|---|---|
| Neon | 512 MB storage, 1 branch | Plenty for this project |
| Render | 750 hours/month, sleeps after 15min idle | Wakes up in ~30 seconds |
| Vercel | 100 GB bandwidth, unlimited deploys | No limits for small apps |

### Render sleep note
On the free tier, Render spins down your backend after 15 minutes of inactivity.
The first request after sleep takes ~30 seconds to respond.
To avoid this, upgrade to Render Starter ($7/month) or use a free uptime monitor
like https://uptimerobot.com to ping the `/api/health` endpoint every 10 minutes.

---

## Alternative: Deploy Everything on Railway

Railway is simpler — one platform for backend + database.

1. Go to **https://railway.app** → Sign up
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Railway auto-detects Node.js
5. Add a **PostgreSQL** plugin from the dashboard
6. Railway auto-sets `DATABASE_URL` from the plugin
7. Add other env vars manually
8. Frontend still goes to Vercel

---

## Alternative: Docker Compose (Self-hosted / VPS)

If you have a VPS (DigitalOcean, AWS EC2, etc.) use Docker:

```yaml
# docker-compose.yml at lms/ root
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: lms_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/lms_db
      JWT_SECRET: your_jwt_secret
      JWT_REFRESH_SECRET: your_refresh_secret
      NODE_ENV: production
      FRONTEND_URL: http://localhost:3001
    ports:
      - "5001:5001"
    depends_on:
      - db
    command: >
      sh -c "npx prisma migrate deploy && node dist/server.js"

  frontend:
    build: ./frontend
    ports:
      - "3001:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

To run:
```bash
docker-compose up --build
```

---

## Environment Variables Summary

### Backend (Render / Railway / Docker)
| Variable | Example Value | Required |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | ✅ |
| `JWT_SECRET` | `long_random_string_32+chars` | ✅ |
| `JWT_REFRESH_SECRET` | `another_long_random_string` | ✅ |
| `JWT_EXPIRES_IN` | `15m` | ✅ |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `FRONTEND_URL` | `https://your-app.vercel.app` | ✅ |
| `PORT` | `5001` | Optional |

### Frontend (Vercel)
| Variable | Example Value | Required |
|---|---|---|
| `VITE_API_URL` | `https://lms-backend.onrender.com` | ✅ |
