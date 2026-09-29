# Webcup Development Guide (AGENTS.md)

Engineering rules and conventions for the Webcup Base scaffold.

## Architecture Decisions

### Server (server.ts)
- Custom Node.js HTTP server wrapping Next.js — required for Socket.IO sharing
- Bundled to `server.cjs` via esbuild for production (avoids tsx/Next 15
  AsyncLocalStorage incompatibility)
- `NODE_ENV=production` required for production builds

### Database
- Prisma ORM with MySQL connection pooling (`connection_limit=5`)
- Migrations applied via `prisma migrate deploy`
- Seed script (`prisma/seed.ts`) creates demo accounts:
  - `admin@webcup.demo` (Admin) / `admin123`
  - `moderator@webcup.demo` (Moderator) / `mod123`
  - `user@webcup.demo` (User) / `user123`

### Auth
- BetterAuth with RBAC extension
- Password hashing via @node-rs/argon2 (faster than bcrypt on Edge)
- Session stored in MySQL `sessions` table

### i18n
- French is the default locale; English is one click away
- Locale stored in a cookie, not URL — keeps routes canonical
- Server-side dictionary is passed to client to avoid hydration mismatch

### Realtime
- Socket.IO v4 with `/api/socket` mount point
- Automatic fallback to HTTP polling when WebSockets unavailable
- Presence tracking via room join/leave events

## Code Style

### Imports
- Path alias `@/` maps to `src/`
- `@emails` maps to project root `emails/`
- Type-only imports use `import type { ... }`

### Conventions
- Server components by default; mark client components with `"use client"`
- All database calls go through service layer → repository layer
- API routes validate input with Zod schemas
- Errors extend `AppError` with HTTP status code and error code

### Naming
- DTOs: `{Entity}Dto` (e.g., `PostDto`)
- Queries: `{Entity}Query`
- Input types: `{Entity}Input`
- Repositories: `{entity}.repository.ts`
- Services: `{entity}.service.ts`

## Quality Gates

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run build         # Next.js + server bundle
npm test              # Vitest
```

### Pre-commit
- All tests must pass
- Lint must be clean
- Typecheck must pass
- Build must succeed

## Deployment

### Local Development
```bash
./scripts/dev-start.sh
```

### Production
```bash
npm run build
node scripts/start.js    # or: pm2 start ecosystem.config.js
```

### PM2
```bash
pm2 start ecosystem.config.js
pm2 restart webcup-base
pm2 logs webcup-base
```

## Testing

Run the smoke test suite (requires server running on :3000):
```bash
npm run smoke
```

Run unit tests:
```bash
npm test
npm run test:watch
```
