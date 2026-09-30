# Webcup — 24H Sprint Guide

> Production-grade Next.js 16 scaffold for the **24H by Webcup** hackathon.

## What's Included

| Category | Stack |
|---|---|
| Framework | Next.js 16 App Router + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Prisma 7 → MySQL/MariaDB (MariaDB driver adapter) |
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
npm run db:deploy

# Seed jury accounts and demo data
npm run db:seed
```

Jury accounts — all four use the password `Webcup-2026!jury`:

| Account | Role |
|---|---|
| `admin@webcup.demo` | ADMIN |
| `moderator@webcup.demo` | MODERATOR |
| `user@webcup.demo` | USER |
| `user2@webcup.demo` | USER (for testing access control between accounts) |

### 2. Run the server

```bash
# Development (Next.js dev server + Socket.IO on one port)
npm run dev

# Production (bundled CJS server)
npm run build       # builds Next.js + server.cjs
npm start           # or: pm2 start ecosystem.config.js
```

> **Note on NixOS:** Prisma publishes no prebuilt schema engine for `linux-nixos`, so the CLI would fail while fetching it. `prisma.config.ts` finds the engine nixpkgs already provides and points the CLI at it. Prisma 7 needs no *query* engine — the MariaDB driver adapter does the talking — so nothing else has to be configured.

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

`server.ts` is bundled to `server.cjs` with esbuild, in development and in production alike. TypeScript loaders such as tsx rewrite Next's module resolution and its request handler then fails with `Invariant: AsyncLocalStorage accessed in runtime where it is not available`; plain `node` on esbuild's CJS output does not have that problem.

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
