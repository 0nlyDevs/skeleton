# Webcup Features

Every item below is implemented and reachable in the running app. Anything that
was only planned has been removed rather than listed — a feature list that
overstates is worse than a short one.

## Terra Nova — requests from the Nova Terra API

The portal of Terra Nova, the first human city on another planet. Each line
maps a `request_code` from the official API to what was built and where to test
it. Test accounts: see `prisma/seed.ts` (password set by `SEED_PASSWORD`).

| Code | Request | Status | Where |
|---|---|---|---|
| D01 | Account creation | done | `/register`, then lands in `/space` |
| D03 | Login to a personal space with my info and procedures | done | `/login` → `/space`: details, request counters, every request and its status |
| D04 | Contact the city services, with confirmation | done | `/contact`: service, subject, message; confirmation with the `TN-xxxxxx` reference, notification and email |
| D05 | Present the city services | done | `/services` (search, categories), `/services/<slug>` (how to, hours, contacts, "Faire une demande") |
| D06 | City announcements | done | `/announcements` (category filter, pinned first), `/announcements/<slug>`; agents publish from `/agent/announcements` |
| D07 | Homepage with clear hierarchy | done | `/`: who you are and what to do, four main paths, services, latest announcements |
| D08 | Citizen, agent and administrator profiles | done | Roles USER / AGENT / ADMIN shown as Citoyen / Agent municipal / Administrateur; each gets its own tools |
| D09 | Access control | done | Agent pages show a 403 to citizens; every endpoint re-checks the role; another citizen's request reads as 404; services are admin only |
| D19 | Agent workspace showing the Nova Terra API | done | `/agent` (separate layout and navigation), `/agent/feed`: session, wave, countdown, requests with difficulty and XP, team tracking |
| F22 | Agents see citizen requests, their state and what needs action | done | `/agent/requests`: status tabs with counts, "Action requise" when new or when the citizen answered, take / release, internal notes, history |
| F37 | Visible protection against repeated sign-in attempts on many accounts | done | `/login`: attempts left after a wrong password, then a pause with a live countdown and a reset link; the owner gets an alert (`/settings/security?alert=locked`, failed attempts listed); admins see `/admin/security` (live status, failures per hour, sources, locked accounts) |
| F38 | Know a service is unavailable before starting a procedure, when to come back and what to do instead | done | `/services` lists disrupted services first; the service page, the request form and the map card show the reason, the expected return (or "not known yet"), an alternative service with its phone, and that a request can still be sent; agents report, update and close interruptions at `/agent/service-status`; residents with an open request on the service are notified when it stops and when it is back; planned maintenance is announced ahead and ends by itself |
| F39 | Book an appointment with an agent, without ambiguity about the slot, with what to prepare | done | `/appointments/new` (or "Prendre rendez-vous" on a service page): pick a day then a time, each with its length, place or phone, agent and service, all in one stated time zone (Terra Nova time); a full summary before confirming; the appointment page lists what to prepare (fixed checklist plus optional AI advice), adds to a calendar (.ics) and opens a conversation with the agent; agents open slots and follow bookings at `/agent/appointments`; one slot can never hold two bookings (database constraint) and a resident cannot hold two at once; both sides are notified of bookings and cancellations |
| F40 | A reminder before my appointment | done | The resident chooses a reminder the day before and/or one hour before (at booking, changeable until the appointment); a server job sends them by notification and email, never twice, and skips a reminder that would arrive right after a late booking; the agent gets the one-hour reminder too |
| F57 | Assess the platform's environmental performance and make it lighter | done | `/eco`: EcoIndex grade, weight, requests, slow-3G time and CO2/water per visit for each main page, before and after; measured by `npm run eco:audit` (headless Chrome) |
| F58 | Sober design and loading choices on the main journeys | done | 3D models 60% lighter and cached for good; 3D on the home, sign-in and map pages loaded only when shown and never in eco mode; five font files instead of eight; visitors poll for updates every 20 s instead of every second |
| F59 | Usable on a very slow connection, explained without jargon | done | Eco mode switches on by itself for `Save-Data` or a 3G-or-worse connection, from the first byte; a short message says why and offers the full version; the map opens in 2D with every service |
| F60 | Images and media do not weigh pages down | done | Each upload is served at 160/320/640/1080 px through `srcset`, generated once and cached on disk; off-screen images load on scroll; favicon 26 KB to 1 KB |

Technical notes:

- The API key stays on the server (`WEBCUP_API_KEY`). A poller syncs the feed
  every `WEBCUP_POLL_SECONDS`, keyed by `request_code` (no duplicates), keeps
  requests that leave the feed as "retirée" instead of deleting them, stores
  the last error, and pushes `webcup:feed` to agents when new codes arrive.
- Citizen messages are encrypted at rest; citizens never see internal notes or
  which agent answered ("Services de Terra Nova").
- Every change to a request is written to its history and to the audit log.

## Authentication & Authorization

- Email/password sign-up, with the account created before the email is sent
- Email verification: the link points at `/verify-email?token=…`, and a rejected
  or unconfigured mail provider writes the link to `.mail-outbox/` instead of
  losing it
- Password reset by email, with a rotating single-use token (1-hour expiry)
- Two-factor authentication (TOTP) with backup codes
- RBAC with a total order: `ADMIN` > `AGENT` > `USER` (AGENT = city agent, who also moderates)
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
- Sign-in: 5 wrong passwords per account in 15 minutes pause that account; 20
  failures per IP in an hour, across all accounts, pause that IP (credential
  stuffing). A successful sign-in clears the account counter only, so logging
  into one's own account never resets the IP budget
- One resident's typos never lock out a shared network: sign-in has no
  every-attempt IP counter
- Each failure is audited (`auth.sign_in_failed`, `auth.sign_in_locked`); the
  owner of a locked account is alerted at most once an hour

## Performance

- Cache-aside helper with single-flight coalescing, so concurrent misses for the
  same key run the loader once
- Bounded, per-user AI and upload limits

## Content

- Posts: create, edit, soft-delete, restore, detail view
- Filtering (scope, published, free text), sorting and pagination
- Explicit DTOs — responses are whitelisted, never raw database rows
- Tags per post
- Public community feed at `/feed`, with a live socket stream, cursor-based
  paging, and a composer for published posts
- Public post pages at `/feed/[id]` with threaded comments, replies, reactions,
  live comment and engagement updates, and reporting
- Follow and unfollow accounts, browse public profiles at `/profile/[username]`, and
  search users by public name or handle

## Realtime

- Socket.IO mounted on the same HTTP server as Next.js (one port, because only
  one port is proxied on shared hosting), or the short-poll relay under
  Passenger; both carry the same events through the same server handlers
- Typing indicators and presence in chat rooms
- Socket-first direct messages and groups, including member roles, invites,
  unread counts, and HTTP fallback only when Socket.IO has degraded
- Date plus id-tie-break cursors for chat history and polling; deleted messages
  are retained as moderation placeholders
- Live notifications with read/unread state, deduplicated by id
- The unread count has a single source of truth shared by the bell and the list

## Social network

- Feed with three tabs: **Pour vous** (ranked by embedding similarity to what
  you engage with, freshness, follows and engagement), **Abonnements** (people
  you follow, never your own posts) and **Récents**
- Posts with text, up to six images, @mentions (highlighted while typing),
  a place, a poll, and an **audience** (public, followers, only me) that can be
  changed after posting; every read path enforces it
- Polls: single or multiple choice, duration, live results, retract, and the
  list of who voted for each option
- Reactions (six emojis) on posts, comments and chat messages, each with
  "who reacted"
- Comments in a modal with one-level replies, edit, delete, report
- One **Share** button: repost (caption optional, audience of your choice) or
  send the post into one or more conversations, rendered as a preview card
- Saved posts (private), semantic search, "similar posts"
- Public profiles with banner, bio, followers / followings lists and a
  **Friends** badge for mutual follows; usernames change at most every 30 days
- Blocking: hides posts, comments and profiles both ways, removes follows and
  refuses follows, mentions and messages; managed in Settings › Privacy
- Notifications for follows, comments, replies, reactions (posts and
  comments), mentions, shares, group activity, moderation and new devices

## Groups

- Public or private, optional **join approval** for public groups, cover image
- Roles OWNER / ADMIN / MODERATOR / MEMBER with a rank-checked permission
  matrix; roles are badged on posts, comments and rosters
- Requests, bans, role changes, group feed with its own live channel

## Messages and calls

- Direct and group conversations, socket-first; edit, delete for me, delete
  for everyone, replies (quoted, jump to original), reactions
- Typing indicator (never shown to the typer), presence and last seen,
  read receipts and delivery state
- Images staged in the composer until Send; any photo format is converted in
  the browser; pasted images (Ctrl+V) work in chats and composers
- Delete a conversation for yourself; group admins rename it, set a photo or
  delete it for everyone
- Peer-to-peer **audio and video calls** (WebRTC) from direct conversations;
  calls ring until missed, including for people who come online meanwhile

## Pages (page builder)

- Block-based public pages at `/p/<slug>`: heading, text, image, gallery,
  quote, link button, video (YouTube/Vimeo, loaded on click), divider,
  countdown, key figures, timeline
- Templates: blank, farewell, imaginary country, product launch, event,
  tribute; seven themes and three fonts; draft / public / unlisted
- Likes, view counts, QR code, reporting and moderation

## Maps and location

- OpenStreetMap map of geotagged posts, place search and reverse geocoding
  through a throttled, cached proxy; coordinates rounded to ~100 m
- Optional automatic town on new posts (never an exact address), with a
  privacy switch

## Trust, privacy and eco-design

- Privacy policy and terms pages
- Data export (JSON) and account deletion with password confirmation
- Private messages, birth dates and notification bodies encrypted at rest
  (AES-256-GCM); passwords checked against known breaches (k-anonymity)
- New-device sign-in alert ("Est-ce bien vous ?")
- **Eco mode**: no animation, banners, covers or 3D, set by cookie so the
  server sends the light page directly; switched on automatically for data
  saving or a 3G-or-worse connection (`Save-Data`, `ECT` client hint, or
  `navigator.connection` before first paint), and an explicit choice always wins
- **Measured footprint**: `npm run eco:audit` loads the main pages in headless
  Chrome and writes `src/data/eco-report.json` (EcoIndex), shown on `/eco`
- Uploaded images exist at four widths (`/api/files/<id>?w=640`), generated
  once with sharp and served through `srcset`
- Installable web app (manifest) and a service worker that retries dropped
  requests and caches immutable build assets

## Deployment (Hodifly / cPanel / Passenger)

- Production build with webpack and memory optimizations to stay under the
  host's 2 GB RAM cap; standalone output pruned to fit 300 MB
- Pending database migrations applied at the start of every build
- Realtime over a short-poll relay under Passenger (Apache breaks WebSocket
  upgrades and caps concurrent requests); Socket.IO everywhere else
- Server warnings and errors mirrored to `~/logs/skeleton-app.log`

## Admin panel

- User management: role changes and bans, both written to the audit log
- Content moderation queue for reports on posts, comments, messages, and public
  profiles; staff removals are audited and notify affected authors
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
