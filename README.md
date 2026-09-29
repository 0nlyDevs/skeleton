# Webcup Base

Production-grade Next.js 15 skeleton for the **24H by Webcup** hackathon sprint.

A full-stack, authenticated application scaffold with roles, modular CRUD, realtime, audit trail, and AI integration — built to ship on a 24-hour deadline.

## Quick Start

```bash
# Install dependencies
npm install

# Build the Next.js app and server bundle
npm run build

# Run the bundled server
npm start
# or: ./scripts/dev-start.sh
```

## Architecture

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript (strict)
- **Database:** Prisma ORM → MySQL/MariaDB with pooled connections
- **Auth:** BetterAuth with RBAC (admin/moderator/user), 2FA, email verification
- **Realtime:** Socket.IO with polling fallback
- **AI:** OpenRouter integration (Gemini 2.0 Flash / Llama 3.3 70B)
- **UI:** shadcn/ui + Radix + Tailwind CSS v4 + GSAP animations
- **Deployment:** PM2 with `ecosystem.config.js`

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
  dev-start.sh      # Local development server launcher
  start.js          # Production server launcher (detached spawn)
  deploy.sh         # Zero-downtime deploy script
  smoke.ts          # Smoke test suite

prisma/
  schema.prisma     # Data model
  migrations/       # SQL migrations
  seed.ts           # Database seed

server.ts           # Custom Next.js server (HTTP + Socket.IO)
```

## Environment

Copy `.env.example` to `.env` and fill in values. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `BETTER_AUTH_SECRET` | Session encryption key (32+ chars) |
| `OPENROUTER_API_KEY` | AI API key (optional — disables AI if empty) |
| `RESEND_API_KEY` | Email API key (optional — logs if empty) |

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with tsx watch |
| `npm run build` | Build Next.js app + server bundle |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | tsc --noEmit |
| `npm test` | Run tests |

## License

MIT
