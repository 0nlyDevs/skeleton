#!/usr/bin/env bash
# Deploy script for webcup-skeleton.
#
# Usage: ./scripts/deploy.sh
#
# Performs a zero-downtime deploy:
#   1. Pull latest code
#   2. Install dependencies
#   3. Run migrations
#   4. Build the Next.js app + server bundle
#   5. Restart via PM2
set -euo pipefail

APP_DIR="/home/cocofioren/webcup-skeleton"
cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing dependencies..."
npm ci --prefer-offline

echo "==> Running database migrations..."
npx prisma migrate deploy || {
  echo "Migration failed — rolling back"
  exit 1
}

echo "==> Seeding database (idempotent)..."
npx tsx --env-file=.env prisma/seed.ts || true

echo "==> Building Next.js app..."
npx next build

echo "==> Building server bundle..."
npm run build:server

echo "==> Restarting PM2..."
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

echo "==> Deploy complete."
