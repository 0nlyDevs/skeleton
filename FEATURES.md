# Webcup Features

Every item below is implemented and reachable in the running app. Anything that
was only planned has been removed rather than listed — a feature list that
overstates is worse than a short one.

## Authentication & Authorization

- Email/password sign-up, with the account created before the email is sent
- Email verification: the link points at `/verify-email?token=…`, and a rejected
  or unconfigured mail provider writes the link to `.mail-outbox/` instead of
  losing it
- Password reset by email, with a rotating single-use token (1-hour expiry)
- Two-factor authentication (TOTP) with backup codes
- RBAC with a total order: `ADMIN` > `MODERATOR` > `USER`
- Deny-by-default API wrapper: every route is authenticated unless it says
  `publicRoute`, and role checks run server-side
- Not-yours reads as `404`, never `403` — no enumeration oracle
- Bans take effect immediately: a banned session stops resolving and no new
  session can be created
- Session management: 7-day sessions, rotated on refresh, revocable per device
- Nobody can grant a role above their own

## Rate limiting

- Per-IP **and** per-account counters on sign-in, sign-up, password reset,
  verification resend and 2FA challenges
- Counters are cleared when a session is actually created, so the rule is
  "5 *failed* attempts", not "5 attempts"
- The socket address is injected by the HTTP server, so limits key on real
  clients rather than one shared bucket
- Pluggable store: in-memory by default, `RATE_LIMIT_STORE=database` for
  multiple workers
- Brute-force attempts are answered with `429` and `Retry-After`

## Performance

- Cache-aside helper with single-flight coalescing, so concurrent misses for the
  same key run the loader once
- Bounded, per-user AI and upload limits

## Content

- Posts: create, edit, soft-delete, restore, detail view
- Filtering (scope, published, free text), sorting and pagination
- Explicit DTOs — responses are whitelisted, never raw database rows
- Tags per post

## Realtime

- Socket.IO mounted on the same HTTP server as Next.js (one port, because only
  one port is proxied on shared hosting)
- Automatic fallback to HTTP polling, with the active transport shown in the UI
- Typing indicators and presence in chat rooms
- Live notifications with read/unread state, deduplicated by id
- The unread count has a single source of truth shared by the bell and the list

## Admin panel

- User management: role changes and bans, both written to the audit log
- Content moderation queue fed by user reports
- Audit log with filters, including actor and before/after metadata
- Feature flags toggled from the settings screen
- Platform statistics: users by role, content, storage, verification rate

## AI assistant

- Any OpenAI-compatible endpoint (OpenRouter by default), configured by
  `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`
- Chat, post summarisation and tag suggestion
- Optional fallback model, so exhausting one model's quota degrades instead of
  failing
- The API key never leaves the server and calls are rate-limited per user

## Uploads

- Multipart upload with a size cap and MIME check by magic bytes, not by the
  submitted content type
- Private by default; files are served through an authorised route rather than a
  public directory

## System

- i18n: French by default, English toggle, cookie-based (FR and EN dictionaries
  are typed against each other, so a missing key fails the build)
- Light/dark theme with no flash on load
- Responsive down to 390px
- Security headers: CSP with a per-request nonce, HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, no `X-Powered-By`
- Sensitive-path blocking for `.env`, `.git`, backups, lockfiles and editor
  directories
- Structured request logging with a correlation id
- Health endpoint reporting database, mail, AI, realtime and rate-limit status
- Secret-authenticated maintenance job for cron
