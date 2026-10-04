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
| F52 | Back a problem already reported by other residents | done | `/reports` lists the city's reported problems (kind, district, title, state, support count — never a name or the message); "Je suis aussi concerné" backs a report once per resident (unique in the database), shows "Vous soutenez ce signalement depuis le …", keeps one support per resident, and notifies everyone backing it at each state change; the request form shows similar open reports nearby before a new one is sent |
| F80 | Rank the city's work by priority, with a suggested priority and its reasons | done | `/agent/requests`: sort by priority (or recency/support), and a "Priorités suggérées" panel proposes the rising requests with the reasons (waiting without an agent, backed by residents, urgent words in the subject, a safety or water problem) and applies the priority in one tap; the pure scorer (tested) lives in `city-requests.priority.ts` |
| F79 | Filter and sort requests and reports by subject, district and state | done | `/space/requests` (the resident's own requests) and `/reports` filter by district and state, search a subject or reference and sort by most recent or most supported; agents get the same filters on `/agent/requests` |
| F49 | Be told when my request changes state, at the right moment, with what to know or do | done | Each status change sends a notification and an email saying what the new state means and what to do ("Action requise" first when the city waits for the resident, with a link straight to the reply box); the request page opens with a "what it means / what you need to do" block and an "Answer now" button; requests waiting on the resident are flagged "Action requise" in their list; updates arrive live |
| F57 | Assess the platform's environmental performance and make it lighter | done | `/eco`: EcoIndex grade, weight, requests, slow-3G time and CO2/water per visit for each main page, before and after; measured by `npm run eco:audit` (headless Chrome) |
| F58 | Sober design and loading choices on the main journeys | done | 3D models 60% lighter and cached for good; 3D on the home, sign-in and map pages loaded only when shown and never in eco mode; five font files instead of eight; visitors poll for updates every 20 s instead of every second |
| F59 | Usable on a very slow connection, explained without jargon | done | Eco mode switches on by itself for `Save-Data` or a 3G-or-worse connection, from the first byte; a short message says why and offers the full version; the map opens in 2D with every service |
| F60 | Images and media do not weigh pages down | done | Each upload is served at 160/320/640/1080 px through `srcset`, generated once and cached on disk; off-screen images load on scroll; favicon 26 KB to 1 KB |
| F73 | The High Council publishes an official message everyone sees at once, and understands what to know and do | done | `/agent/official` (administrators): title, "what residents must know", "what they must do", optional button to a page, time on screen, live preview, confirmation, history with withdraw. The message hangs from the top of every screen (landing, sign-in, app) the moment it is published (socket push, 60 s polling for visitors), with "À faire", its end time and "J'ai lu"; it never blocks the page. Every resident also gets a notification; the current message stays readable on `/announcements`. One message at a time: a new one replaces the previous. Recorded in the agents' history |
| F74 | See a partner association's hours and where to find it, without going through several screens | done | `/services`: each card says "Ouvert · ferme à 17 h" or "Fermé · ouvre lundi à 8 h 30" (computed from structured weekly hours), the district and address, "Voir sur la carte" and the phone; filters "Ouverts maintenant" and "Associations partenaires". The service page shows the week with today marked. Administrators set hours and the "partner association" switch in the service form. Three seeded associations |
| F76 | Leave a comment after using a service, with a clear trace that it was taken into account | done | "Donner mon avis" on every service page, and "Comment ça s'est passé ?" on a finished request (one comment per request): five levels and a few words. The confirmation gives a reference `AV-xxxxxx` and three steps (reçu, lu par le service, réponse). `/space/feedback` ("Mes avis") shows each comment, its steps with dates and the service's answer; the resident is notified at each step. Agents read, confirm reading and answer in `/agent/feedback`. Comments are private (encrypted at rest); service pages only show overall satisfaction |
| D10 | Residents find the right service even when they word their need badly | done | "De quoi avez-vous besoin ?" at the top of `/services` and of the resident home: one field, the resident's own words. A local scorer tolerant to spelling mistakes, missing accents, plurals and word starts, with a table of everyday words (robinet, loyer, bus, naissance…) and a sense of the whole sentence, ranks the services; the answer is one plain sentence and up to three services (stopped services are flagged, open/closed shown). If nothing fits, it says so and offers to send a request, which an agent routes. Works without the AI model |
| F89 | A plain-language version of essential administrative content, keeping meaning and key facts | done | Every service description, "comment faire" and announcement has "Expliquer plus simplement". The version is short lines in everyday words; the model writes it when available, and the result is dropped for the local rewrite if any number, date or amount of the original is missing. Without the model a local pass splits long sentences and swaps administrative phrases (afin de → pour, acquitter → payer…). Cached for a day; the official text always stays above, with a note |
| F90 | Ask for a simpler explanation only when needed, without changing the platform | done | The explanation is on demand, per passage: one button under the hard text, no setting, no change anywhere else; it appears under that passage and can be ignored |
| F91 | Automated assistance to guide residents to the right answer or service, even from an imperfect request | done | The same finder, plus: an urgent word shows the emergency call button first; when the AI model is available it reads the candidates and writes a one-sentence "go there because…" (it can only choose among real active services, 6 s timeout, cached for an hour). Public endpoint `/api/orient`, rate limited. The assistant page works again: the provider's reasoning model was timing out on every call and now answers in about two seconds, with a smaller fallback model |
| F92 | Describe a need simply and be directed to the right service or procedure | done | Same finder: the resident describes the need, gets the service page ("comment faire", hours, where to find it) and the matching request form one tap away; the contact form keeps its service choice and templates for those who prefer to write |
| F50 | A simplified activity dashboard for agents | done | `/agent` opens on the day in three levels: "À traiter maintenant" (requests without an agent, new requests, waiting for the resident, comments to read, each a link to the right list; a red line when an emergency is open), the pace of the work (received today and this week, average time to the first answer and to resolution), "Dans la ville" (today's appointments, active alerts, disrupted services, and for administrators failed sign-ins in 24 h), and a 14-day chart (received and finished). One cached aggregate (60 s) serves every agent |
| F75 | Help agents spot requests about the same problem and find what needs attention as volume grows | done | `/agent/requests` starts with "Sujets qui reviennent": open requests grouped by similarity (subject, message, kind of problem, district) with a short title (from the AI model when available, otherwise from the words they share), how many need action and the oldest age; one tap lists the references. On an agent's request page, "Demandes similaires" lists the closest open ones. Grouping works without the model (local text embedding) and is cached for a minute. Together with the priority panel, the sort by support, and the status tabs with counts, agents find what needs them first |
| F65 | Decisions submitted to the residents, with a clear and trustworthy participation | done | `/participate?tab=votes`: each decision has a question, what is decided, options, opening and closing times. One ballot per resident, enforced by a unique rule in the database; the resident gets a receipt `VT-xxxxxxxx` that proves the vote counted without saying what was chosen. Results (per option and total) are published when the vote closes, so nobody votes after seeing a trend; before that the page says so. Administrators open votes in `/agent/participation`; residents are notified; each action is in the history (a ballot is recorded without its content) |
| F66 | Give an opinion on city projects without it being heavy | done | On each project card: three choices (pour, sans avis, contre) and an optional word. One opinion per resident per project, changeable while the consultation is open; the totals are shown, never who said what; closed consultations show a plain note |
| F67 | Consult the city's projects | done | `/participate` (in "Ville", public): each project shows what, where (district), when, budget in credits, progress bar, state (prévu, en cours, terminé) and the full text on one tap. Administrators publish and update projects; residents are notified of a new one |
| F68 | Propose ideas to improve the colony, simple to do | done | `/participate?tab=ideas`: a short form (title, idea, district) gives the idea a reference `ID-xxxxxx`. Other residents support it once each (not their own); the list sorts by most supported or most recent. States: reçue, à l'étude, retenue, non retenue, réalisée, with the city's written answer; the author is notified and sees "Votre idée". Agents answer from the same list |
| F77 | A heavy overload is detected: the platform must stay pleasant without giving up essential information and actions | done | The server measures itself (requests in flight, recent response time, event-loop delay). Past the threshold it enters "essential mode" by itself and leaves it 45 s after the load drops: the assistant, recommendations, social feed, people search, statistics and exports answer at once "en pause un instant… réessayez dans une minute" (HTTP 503 + `Retry-After: 60`) instead of queueing, so requests, alerts, services, appointments and the official message keep answering. Residents see one calm line above the page saying what works and what is paused. Administrators see the live figures in `/agent/data` and can force the mode before a known peak |
| F78 | Stay stable when many residents connect at the same time | done | Load shedding above, plus what was already in place: per-IP and per-account rate limits on every API route (429 with a plain message), pooled database connections, short caches on the hot public reads (official message, admin overview), stateless server, images served in four sizes and cached, eco mode for slow links. `npm run load:test -- <url> <requests> <concurrency>` (no dependency) hits the pages residents need most and prints requests per second, median, p95 and how many requests the server chose to defer |
| F81 | Robots try to send forms automatically; the protection must be felt without making normal use harder | done | The request form asks the server for a signed token when it opens and carries a hidden trap field. The server refuses a form with no token, a forged token, a filled trap, or one sent in under 2.5 seconds (plain message: "C'était très rapide. Attendez quelques secondes"). People see only one line under the form ("protégé contre les envois automatiques"), no puzzle. Blocked attempts are counted and shown to administrators in `/agent/data` ("formulaires bloqués"), next to the existing rate limits |
| F82 | The same form can be sent several times without control | done | Sending the same request again within 10 minutes (same resident, subject and message) is refused with "Vous avez déjà envoyé cette demande il y a un instant. Sa référence est TN-xxxxxx", so a double click or a retry never creates two files. The button is disabled while sending. Comments on a request are limited to one per request (database rule) |
| F83 | Keep a proof that the city received my request, with a reference I can quote | done | Every request has a receipt: `/space/requests/<ref>/receipt` shows who received what and when, the reference and a check code, and prints on one page (or saves as PDF). The code is also in the confirmation e-mail and on the request page. Anyone shown the receipt can check it on `/receipt` (reference + code): the page answers "authentique, reçue le …" without any personal data. The code is a signature, so it cannot be invented |
| F84 | Agents answer some requests directly from their interface | done | On a request in `/agent/requests/<ref>`, the reply box has "Réponses rapides" (bien reçu, précision demandée, intervention prévue, c'est réglé): one tap fills the answer, the agent adjusts and sends; the resident is notified. Internal notes stay separate |
| F85 | Unusual activity was detected and some information looks incoherent | done | `/agent/data` (administrators): eight coherence rules checked on live data, each as a sentence with a filled or empty bubble and the number of cases (finished request without end date, request given to a resident, request under way without agent, rating out of range…), a verdict line, and the last 24 hours of signals: failed sign-ins, paused accounts, forms blocked as robots, role changes. "Vérifier à nouveau" reruns it |
| F86 | Someone reports a medical emergency: it cannot be handled like an ordinary request | done | As soon as the words of an emergency are typed in a request (malaise, ne respire plus, hémorragie…), the form shows "Urgence médicale ? Appelez d'abord" with the emergency number as a call button. If sent, the request is created as Urgente, every agent gets an alert notification "URGENCE MÉDICALE", it sorts first in the agents' list and its page opens with a red line "à traiter avant toute autre demande" |
| F87 | Check that important data can be saved correctly, with a clear result | done | `/agent/data` (administrators): "Sauvegarder maintenant" copies ten important tables to one compressed file, reads the file back from disk and compares checksum and row counts. The report says in words whether the copy matches, rows per table, size, time and checksum; the last five copies are listed and each is re-checked ("intacte" or "abîmée"). Encrypted fields stay encrypted. Recorded in the history |
| F88 | Send part of the follow-up data to other services: choose the useful information, get a reusable format | done | `/agent/exports` (agents and administrators): choose a dataset (requests, appointments, comments), the columns, a period and CSV (spreadsheet) or JSON, then download. Only follow-up columns exist: no name, message or address. CSV cells are protected against spreadsheet formulas. Each export is recorded in the history with its columns |

Also asked by the team: residents can filter people by role (everyone, citizens, city agents, administrators) on `/search` and when starting a conversation, and each person carries a role badge, so finding an agent needs no name.

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

- Terra Nova district map (`/map`) and a district/landmark picker, both drawn
  from the city reference data; a point is a plane coordinate (1000 × 640) and
  its district is always derived server-side. No real-world map, tile server or
  geocoding call is ever made (no OpenStreetMap, no Nominatim)
- Request and post places are points on that map; the optional automatic place
  on a new post uses the resident's saved district (never a real address), with
  a privacy switch

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
