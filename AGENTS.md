# Webcup Development Guide (AGENTS.md)

Engineering rules and conventions for the Webcup Base scaffold.

## Architecture Decisions

### Server (server.ts)
- Custom Node.js HTTP server wrapping Next.js — required for Socket.IO sharing
- Bundled to `server.cjs` via esbuild (dev and production). A TypeScript loader
  such as tsx breaks Next's module resolution and its request handler then
  throws `Invariant: AsyncLocalStorage accessed in runtime where it is not
  available`
- `npm run dev` (`scripts/dev.mjs`) bundles, runs, and restarts only when a file
  inside the bundle changes
- `NODE_ENV=production` required for production builds

### Database
- Prisma 7 with the MariaDB driver adapter. The Rust query engine is gone, so
  there are no `PRISMA_*_ENGINE_*` paths to configure
- The client is generated into `src/generated/prisma` (gitignored) and imported
  as `@/generated/prisma/client`, never from `@prisma/client`
- `prisma.config.ts` holds the schema path, migration path, seed command and
  datasource URL; it also locates a Nix-provided schema engine on NixOS, where
  Prisma publishes no prebuilt binary
- Connection pooling comes from the driver: `connection_limit` and
  `pool_timeout` in `DATABASE_URL` are translated into driver options in
  `src/lib/db/prisma.ts`
- Seed script (`prisma/seed.ts`) creates the test accounts with the password
  in `SEED_PASSWORD`: `cocobrowniees@gmail.com`, `colomberakotonjanahary@gmail.com`
  (ADMIN), `hei.colombe@gmail.com`, `hei.jonathan.3@gmail.com` (MODERATOR),
  `hei.tafita.2@gmail.com`, `hei.harena.2@gmail.com` (USER)
- A credential `Account` row must have `accountId === user.id`; BetterAuth
  rejects anything else as "Invalid email or password"

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
npm run dev               # Next.js + Socket.IO on one port
```

### Production
```bash
npm run build             # prisma generate + next build + server.cjs
npm start                 # or: pm2 start ecosystem.config.js
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
