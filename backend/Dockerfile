# ── Stage 1: Install dependencies ────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# ── Stage 2: Build TypeScript ─────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

RUN npm run build

# ── Stage 3: Production image ─────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install ts-node for seed script + production deps only
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src

RUN npm ci && npx prisma generate

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 5001

# Default command: migrate + start server
CMD sh -c "node dist/server.js"
