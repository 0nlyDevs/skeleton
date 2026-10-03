# Webcup Base

Production-grade Next.js 16 skeleton for the **24H by Webcup** hackathon sprint.

A full-stack, authenticated application scaffold with roles, modular CRUD, realtime, audit trail, and AI integration — built to ship on a 24-hour deadline.

## Quick Start

```bash
npm install

# Create the schema and load the jury accounts
npm run db:deploy
npm run db:seed

# Development: Next.js dev server + Socket.IO on one port
npm run dev

# Production
npm run build && npm start
```

`npm run dev` bundles `server.ts` with esbuild and runs it under plain `node`.
That is not ceremony: TypeScript loaders (tsx/ts-node) rewrite Next's module
resolution and make its request handler throw
`Invariant: AsyncLocalStorage accessed in runtime where it is not available`.

The dev launcher watches only the files that end up *inside* the server bundle,
so editing a page or a component does not restart the process — Next's own hot
reload handles those.

## Demo accounts

`npm run db:seed` creates these. All four share the password **`Webcup-2026!jury`**.

| Email | Role | Use it to check |
|---|---|---|
| `admin@webcup.demo` | ADMIN | The admin console: users, roles, audit log, feature flags |
| `moderator@webcup.demo` | MODERATOR | The moderation queue: reports, post removal |
| `user@webcup.demo` | USER | The member experience: feed, posts, groups, chat, profile |
| `user2@webcup.demo` | USER | A second member, for anything that depends on two identities |

`user2@` exists so access control can be tested honestly: follow/unfollow,
direct messages, and post visibility all behave differently when a *different*
signed-in account is involved. Testing those with a single account gives a false
pass.

Passwords are deliberately **not** printed on the landing page — the accounts are
listed there by role and address, but the shared secret stays out of a public
page.

## Architecture

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **Database:** Prisma 7 → MySQL/MariaDB through the MariaDB driver adapter (no Rust engine)
- **Auth:** BetterAuth with RBAC (admin/moderator/user), 2FA, email verification
- **Realtime:** Socket.IO with polling fallback
- **AI:** any OpenAI-compatible endpoint (OpenRouter by default)
- **UI:** shadcn/ui + Radix + Tailwind CSS v4 + GSAP animations
- **Deployment:** PM2 with `ecosystem.config.js`

### Email without a mailbox

Email is optional. With `MAIL_TRANSPORT=log` (or no `RESEND_API_KEY`), every
message — including the verification and password-reset links — is written to
`.mail-outbox/` and logged with its action URL, so the whole auth flow stays
completable on a machine that cannot send mail. Undelivered messages land there
when a provider rejects them too, which is what happens while a Resend account is
still in test mode.

## Project Structure

```
src/
  app/              # Pages: dashboard, posts, chat, auth, admin, settings
  components/        # React components (UI shell, forms, feedback)
  lib/              # Infrastructure: env, db, logger, cache, rate-limit
  modules/          # Feature modules: posts, users, messages, audit
  hooks/            # Shared React hooks
  types/            # Shared types

scripts/
  dev.mjs           # `npm run dev`: bundles the server, restarts it on change
  esbuild-server.mjs# Shared esbuild bundler (dev + production)
  deploy.sh         # Zero-downtime deploy script
  smoke.ts          # Smoke test suite

prisma/
  schema.prisma     # Data model
  migrations/       # SQL migrations
  seed.ts           # Database seed

prisma.config.ts    # Prisma 7 CLI config (schema, migrations, seed, datasource)
server.ts           # Custom Next.js server (HTTP + Socket.IO)
```

`src/generated/prisma` is a build product of `prisma generate` and is not
committed; `npm run build` and `npm run typecheck` both regenerate it first.

## Environment

Copy `.env.example` to `.env` and fill in values. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `BETTER_AUTH_SECRET` | Session encryption key (32+ chars) |
| `AI_API_KEY` | OpenAI-compatible API key (optional — disables AI if empty) |
| `RESEND_API_KEY` | Email API key (optional — messages go to `.mail-outbox/` if empty) |
| `MAIL_TRANSPORT` | `resend` to send, `log` to write to the outbox only |
| `DNS_RESULT_ORDER` | Defaults to `ipv4first`; see the note below |

`DNS_RESULT_ORDER=ipv4first` is a deliberate default. Node resolves hostnames in
"verbatim" order, so on a host whose IPv6 route is broken every outbound request
(Resend, the AI provider) fails as a bare `fetch failed` while `curl` works fine.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server + Socket.IO (esbuild-bundled, watched) |
| `npm run build` | Generate the Prisma client, build Next.js, bundle the server |
| `npm start` | Start the bundled production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `prisma generate && tsc --noEmit` |
| `npm test` | Vitest |
| `npm run smoke` | HTTP smoke test against a running server |
| `npm run db:deploy` | Apply migrations |
| `npm run db:seed` | Load the jury accounts and demo data |

## License

MIT
