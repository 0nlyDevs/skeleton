# Webcup — 24H Sprint Guide

> Production-grade Next.js 15 scaffold for the **24H by Webcup** hackathon.

## What's Included

| Category | Stack |
|---|---|
| Framework | Next.js 15 App Router + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Prisma ORM → MySQL/MariaDB |
| Auth | BetterAuth + RBAC + 2FA + Argon2 |
| Realtime | Socket.IO v4 with polling fallback |
| AI | OpenRouter (Gemini / Llama 3.3) |
| Email | Resend (or log transport for dev) |
| Animations | GSAP + tw-animate-css |
| i18n | French-first, English toggle via cookie |
| Deploy | PM2 + esbuild-bundled server |

## Sprint Workflow

### 1. Get the DB running

```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE webcup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Apply migrations
npx prisma migrate deploy

# Seed demo accounts
npx tsx --env-file=.env prisma/seed.ts
```

Demo accounts:
- `admin@webcup.demo` / `admin123`
- `moderator@webcup.demo` / `mod123`
- `user@webcup.demo` / `user123`

### 2. Run the server

```bash
# Development (hot reload via tsx)
npm run dev

# Production (bundled CJS server)
npm run build       # builds Next.js + server.cjs
npm start           # or: pm2 start ecosystem.config.js
```

> **Note on NixOS:** The Prisma query engine is loaded from the Nix store. See `scripts/dev-start.sh` for the engine path, which is automatically detected.

### 3. Verify

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
```

### 4. Ship

```bash
./scripts/deploy.sh
```

## Architecture

### Custom Server (server.ts)

Next.js standalone can't host WebSockets. The project uses a custom `node:http` server that:

1. Prepares Next.js for SSR
2. Attaches a Socket.IO server for realtime
3. Handles graceful shutdown

In production, `server.ts` is bundled to `server.cjs` via esbuild to avoid the tsx/Next 15 AsyncLocalStorage incompatibility.

### Layers

```
src/
  modules/{feature}/        # Feature module (posts, users, etc.)
    {feature}.repository.ts   # Data access (Prisma)
    {feature}.service.ts      # Business logic
  lib/                       # Cross-cutting infrastructure
  components/                # UI components
  hooks/                     # React hooks
  types/                     # Shared types
```

## Common Tasks

### Add a new route
1. Create `src/app/{route}/page.tsx`
2. Add i18n entries in `src/lib/i18n/dictionaries/{locale}.ts`

### Add a database model
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name {name}`
3. Create `src/modules/{module}/{module}.repository.ts` + `.service.ts`

### Add an API endpoint
1. Create `src/app/api/{route}/route.ts`
2. Validate input with Zod
3. Return `AppError` on failures
