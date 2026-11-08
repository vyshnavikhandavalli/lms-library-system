#!/bin/bash
set -e

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
./node_modules/.bin/prisma generate

echo "==> Compiling TypeScript..."
./node_modules/.bin/tsc

echo "==> Build complete!"
