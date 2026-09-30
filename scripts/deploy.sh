#!/usr/bin/env bash
#
# Deploy script.
#
# Usage:  ./scripts/deploy.sh [branch]
#
# Order matters: dependencies first (the bundler and Next must exist), then
# migrations (the new code may expect new columns), then the build, then the
# restart. Seeding is idempotent and runs after the build so a failing seed can
# never leave the running app without its previous data.
#
# The branch defaults to the one that is checked out — passing "main" while the
# server tracks "preprod" is how a deploy quietly reverts a release.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

echo "==> Fetching $BRANCH..."
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Installing dependencies..."
# `npm ci` needs the lockfile to match package.json exactly; a mismatch here is
# a build problem, not something to paper over.
npm ci --prefer-offline

echo "==> Applying database migrations..."
npm run db:deploy

echo "==> Generating the Prisma client and building..."
npm run build

echo "==> Seeding (idempotent)..."
npm run db:seed

echo "==> Restarting PM2..."
if pm2 describe webcup-base >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo "==> Deploy complete."
