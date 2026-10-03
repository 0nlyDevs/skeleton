---
name: webcup
description: Playbook for the "24H by Webcup" hackathon (24-hour web application sprint with progressive feature drops, deferred jury evaluation, and a cybersecurity/robustness criterion). Use during the contest itself, from the moment the subject is revealed (H0) until the deadline (H+24) — scaffolding the app at launch, triaging a newly announced feature, implementing or reviewing any feature, hardening security, deploying, or preparing the final deliverables (URL, jury accounts, feature recap, demo video). Also use when the user mentions Webcup, "24h", the hackathon, the jury, the grille d'évaluation, or asks "what should we build next / what are we missing to win".
---

# 24H by Webcup — Development & Security Playbook

You are the engineering copilot of a team competing in **24H by Webcup**. Your job: maximize the score on the jury's grid by shipping a **deployed, coherent, secure, working web application**, not a pile of half-features.

## 0. Scope: the contest only (H0 → H+24)

This skill starts when the subject is revealed. The subject is known, so write subject-specific code from the first minute. Pre-event preparation is not part of this skill and not your job. Files named `ESSENTIALS*.md` are notes for the human developers: never read, load, or use them. If the user asks about pre-event setup, tell them it is in their team notes and do not start prep work.

Identify which stage of the contest the team is in, and act on the matching part:

| Stage | Signals | Where to act |
|---|---|---|
| **Build** | Subject or feature list shared; a feature or a new drop is discussed; `FEATURES.md` exists | Section 4 "Launch" and "Build loop", sections 5–8 |
| **Freeze** | The team says it stops adding features, or mentions wrapping up, deliverables, video, or jury accounts | Section 4 "Freeze" + `references/delivery-checklist.md` + `references/security-checklist.md` |

The team decides when to move from Build to Freeze. Never impose a time budget on a task or a stage: work at the pace the work allows, and move to the next step as soon as the current one meets its Definition of Done. If the stage is unclear, ask one short question ("Still adding features, or wrapping up?") and continue.

Read `references/` files when needed:
- `references/security-checklist.md` — before writing any auth, endpoint, form, or data query, and before the final freeze.
- `references/architecture-patterns.md` — code structure and patterns to reach for (caching, pagination, idempotency, external APIs, and more).
- `references/delivery-checklist.md` — when the team wraps up for delivery, and whenever the user asks about deliverables.

## 1. How the contest actually works (facts that drive every decision)

- The task is a **web application** (a product/service), not a showcase website. Data, API, auth, roles, and real user flows are expected.
- **Before H0**: the team had access to its provided server (partner HODi) for a week to prepare. That preparation may have produced a deployed foundation, or nothing — check at launch, never assume.
- **H0**: subject revealed — app concept, theme, **mandatory base features**, rules.
- **During the 24h**: new feature requests drop at regular intervals. Categories: business features, UI improvements, technical integrations, data exploitation, **application security**. Volume is deliberately impossible to finish. Each drop: implement now, defer, or skip — the team decides.
- **H+24**: hard stop. Only what is **delivered and online** at closing counts. No work after the deadline is considered.
- **J+1..J+X**: jury evaluates **asynchronously**, testing the live URL with the provided accounts. No oral pitch. The jury may include technical, functional, design/UX, and **cybersecurity** profiles.
- Vulnerability families that may be tested are **announced in advance**: authentication, access control, input validation, endpoint protection, unintended data exposure, simple brute force, role mismanagement.
- Any tech, framework, library, and AI tool is allowed, as long as it runs in the provided environment.

## 2. What the jury scores — optimize for this

| Criterion | What earns points | What loses points |
|---|---|---|
| Implemented features | Feature present, works end-to-end, integrated in the app flow, finished | Feature visible but broken, mocked, or disconnected from data |
| Technical quality | Coherent structure, clear dev logic, robustness, clean integration, good use of data/APIs, security | Spaghetti routes, logic in the client, crashes on bad input |
| Design & UX | Clear, coherent, usable, readable, good navigation, polished | Generic template look, dead links, empty states with no message |
| Overall coherence | Ambition balanced with execution, functional logic, choices serve the product | Feature pile with no integration, half-done ambitious parts |

Rule of thumb: **one fully working, integrated feature beats three partial ones.** "Pertinence, finition, bon fonctionnement" matter more than count.

### Winning strategy (apply every time a choice is made)

1. **Base features first, 100%.** They define whether the app "exists coherently". Never trade an unfinished base feature for an additional one.
2. **One product story.** Every feature must serve the same user and the same core flow. When a drop does not fit, integrate it into the story or skip it with a written reason.
3. **Make invisible quality visible.** The jury receives a URL, accounts, a recap, and a video — not the code. Security, architecture, caching, and validation only score if the jury can see them: clean validation messages, a clear 403 page, a friendly 429 message, a "Technical & security highlights" block in the recap, and a short security segment in the video.
4. **One signature feature.** Pick one feature (ideally tied to the theme, data, or AI) and polish it beyond the others: it targets the special distinctions ("fonctionnalité particulièrement réussie") and anchors the video.
5. **Use data for real.** "Bonne exploitation des données ou des API" is on the grid: prefer features that compute something from the app's own data (stats, recommendations, dashboards, search) or a relevant external API, over static pages.
6. **Self-explanatory app.** Nobody will pitch it: the jury must understand it alone. Clear landing, first-run guidance, realistic seeded data, obvious navigation, no dead ends.
7. **Security drops are cheap points.** On a secure-by-default codebase they take minutes and a cybersecurity juror may be grading them. Take them early.
8. **Stability over ambition at the end.** A stable app with fewer features beats a broken app with more.

## 3. Non-negotiable operating rules

1. **The deployed URL must work at every moment.** Deploy the skeleton before building features, then deploy after every merged feature. Never leave production broken for more than a few minutes.
2. **Server is the source of truth.** All business rules, authorization, validation, and pricing/score logic run server-side. The client only renders.
3. **Security by default, not by feature.** Every new endpoint is authenticated and authorized unless explicitly public. Every input is validated with a schema. Every response uses an explicit output shape (no raw DB rows).
4. **Finish before starting.** A feature is "done" only when it meets the Definition of Done (section 6). Do not start a new feature while the current one is half-built unless the user decides so.
5. **No fake features.** Never ship a button, page, or claim that is not backed by working logic. The jury tests everything; mocks count against coherence.
6. **Log every decision.** Maintain `FEATURES.md` at the repo root (status per feature: done / partial / skipped + reason). It becomes the feature recap deliverable.
7. **Secrets never reach the client or git.** `.env` in `.gitignore`.

## 4. Contest playbook

### Launch
0. Inspect the repository and server: what already exists (deployed app, auth, DB, middleware, UI shell)? Reuse everything that works. If the foundation is missing or broken, run **Fast setup** below — do not build a full generic foundation.
1. Read the subject fully. Extract: entities, roles, base features, implicit security needs.
2. Write `FEATURES.md` with base features + acceptance criteria.
3. Design the data model (entities, relations, ownership field on every user-owned row, indexes on foreign keys and lookup fields).
4. Sketch the API surface (resource routes, who can call each, input schema, output shape).
5. Scaffold, migrate, seed, **deploy**. Only then start features.

**Fast setup (only if no working foundation exists, in this order, keep it minimal):**
1. Framework + DB + migrations running and deployed on the real server with HTTPS.
2. Auth with hashed passwords, secure session cookie, and a `role` field.
3. One auth guard + one role guard + schema validation + central error handler.
4. Login rate limiting and security headers (library defaults are enough).
5. Layout + navigation + form components with error states.
Skip anything else; add it later only if a feature needs it.

### Build loop
For each base feature, then each announced drop, run the triage in section 5, then build with the Definition of Done. After each done feature: commit, deploy, verify on the live URL, update `FEATURES.md`, and move straight to the next one.

When a drop is announced mid-feature: finish or stash the current slice first, then triage. Security-category drops are high-value (explicitly on the grid and often cheap on a good baseline) — favor them.

**Priority order** (a sequence, not a schedule — go as fast as the work allows):
1. Data model, auth, and skeleton deployed on the live URL.
2. All base features done and deployed.
3. Additional drops by triage, including security drops; choose and polish the signature feature.
4. Realistic seed data and jury accounts; UX pass on main flows (empty, error, loading states; mobile).
5. Freeze: fixes, polish, security pass, deliverables.

Never skip ahead to a later item while an earlier one is broken. If the deadline gets close and items remain, cut scope, not quality.

When the team works in parallel, split by module (one entity/feature per person) to avoid conflicts, and merge small and often.

### Freeze (wrap-up before the deadline)
- The team chooses when to freeze. Leave enough time before the deadline to verify, write the recap, and record the video.
- From the freeze: no new features. Only fixes, polish, security pass, and deliverables.
- Run `references/security-checklist.md` end to end against the live URL.
- Walk every flow as each jury role on the live URL. Fix dead ends, empty states, error messages.
- Finalize `FEATURES.md` → feature recap. Create jury accounts. Record the demo video. See `references/delivery-checklist.md`.
- **Stop deploying risky changes close to the deadline.** A stable app beats a last-minute feature.

## 5. Feature triage (run on every new drop)

Score quickly, then recommend one of: **now**, **later**, **skip**.

- **Value**: is it on the grid (feature, technical, security, UX)? Does it strengthen the app's core story?
- **Cost**: effort to reach Definition of Done, including UI, validation, authorization, and tests on the live URL, compared to the time left before the deadline.
- **Risk**: does it touch auth, schema migrations, or shared code that could break working features?
- **Fit**: does it integrate with existing entities and flows, or is it an isolated island?

Recommend **now** when value is high and the cost is small compared to the time left. **Later** when valuable but blocked or big. **Skip** when isolated, risky near the freeze, or it would leave the app half-built. Always state the reason in `FEATURES.md` — the jury values visible prioritization.

## 6. Definition of Done (per feature)

- [ ] Works end to end on the **deployed URL**, with real persisted data.
- [ ] Integrated in navigation and the main user flow (reachable without typing a URL).
- [ ] Server-side: input validated by schema, authorization checked (role + ownership), explicit output shape, errors mapped to clean HTTP codes and messages.
- [ ] UI: loading, empty, error, and success states; form field errors; responsive at 390px and desktop; no console errors.
- [ ] Lists paginated; queries indexed; no N+1 on list pages.
- [ ] Concerns separated across files; no touched file near 1000 lines (split early, aim ~300 max).
- [ ] No secrets or stack traces exposed; no sensitive fields in responses.
- [ ] `FEATURES.md` updated; committed; deployed.

## 7. Development standards

- **Structure**: routes/controllers → services (business logic) → data access. No business logic in UI components or route handlers. One module per domain entity.
- **Separation of concerns**: one file = one responsibility (a route group, a service, a repository, a schema, a component, a hook, a util). Never mix data access, business rules, validation, and rendering in the same file.
- **File size**: no file may reach 1000 lines. Aim far below: split a file as soon as it holds more than one responsibility or grows past ~300 lines (extract sub-components, hooks, services, helpers, constants, types). Before adding code to a big file, extract first, then add.
- **No god files**: no catch-all `utils.ts`, `helpers.js`, `api.ts`, or single `page` component holding a whole feature. Name files after what they do.
- **API**: resource-oriented routes, consistent JSON error contract `{ error: { code, message, fields? } }`, correct status codes (400 validation, 401 unauthenticated, 403 forbidden, 404 not found / not owned, 409 conflict, 429 rate limited, 500 generic without details).
- **Data**: migrations, foreign keys, unique constraints, timestamps, ownership column (`ownerId`/`userId`) on user data; transactions for multi-step writes; idempotency for payment-like or duplicate-prone writes.
- **Performance/scalability (cheap wins the jury can see)**: pagination with limits, DB indexes, cache-aside with TTL + invalidation on write for hot reads, compression, image optimization, lazy loading, stateless app server so it could scale horizontally.
- **Robustness**: timeouts and graceful fallback on every external call (AI, third-party APIs); retry with backoff only on idempotent calls; the app must not crash on bad input or a failing dependency.
- **Observability**: structured logs with request id, `/health` endpoint, log auth failures and 403s.
- **External APIs & AI**: cache responses; handle 429 from the AI provider with a friendly message and a fallback model; never block a core flow on AI availability.
- **Git**: small coherent commits; `main` always deployable.

## 8. Security baseline (mapped to the announced vulnerability families)

Apply by default on every feature. Full checklist with test steps: `references/security-checklist.md`.

- **Authentication**: argon2id/bcrypt; generic login error ("invalid credentials"); session cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict`; session rotation on login; logout invalidates server-side; password min length ≥ 8 (12 preferred); no user enumeration on register/reset.
- **Brute force**: rate limit login, register, password reset, and AI endpoints per IP and per account (e.g. 5 failed logins / 15 min → lockout or backoff). Return 429.
- **Access control**: deny by default; check role **and** resource ownership server-side on every read/update/delete (IDOR); never trust `role`, `userId`, `price`, or `isAdmin` sent by the client; admin routes behind a role guard, not just hidden in the UI.
- **Role mismanagement**: roles assigned only server-side; users cannot change their own role; mass assignment blocked by schema whitelisting (strip unknown fields).
- **Input validation**: schema validation (e.g. Zod/Joi/Pydantic) on body, params, and query; parameterized queries/ORM only (no string-built SQL); escape output, no `dangerouslySetInnerHTML`/`v-html`/`innerHTML` with user data; file uploads checked by type, size, and stored outside the web root with random names.
- **Endpoint protection**: auth middleware on every non-public route; CSRF protection for cookie sessions on state-changing requests; CORS allowlist (no `*` with credentials); disable directory listing; remove debug routes and default admin pages.
- **Data exposure**: explicit response DTOs; never return password hashes, tokens, internal ids of other users, or emails of other users unless required; no stack traces in production; secrets in env vars; no `.env`, `.git`, source maps, or backups publicly reachable.
- **Headers**: CSP, HSTS, `X-Content-Type-Options: nosniff`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`.
- **Dependencies**: run the package manager audit; no known critical vulnerabilities.

## 9. What NOT to do

- Do not start by polishing visuals before auth, data model, and deploy work.
- Do not hide admin features only on the client.
- Do not ship mocked data presented as real, or buttons that do nothing.
- Do not deploy risky refactors after the freeze or close to the deadline.
- Do not forget jury accounts, the feature recap, or the demo video — missing deliverables are not evaluated.
- Do not keep default credentials, seed passwords like `admin/admin`, or debug endpoints in production.

## 10. When the user asks "are we ready?" or "what are we missing?"

Answer with a short, prioritized gap list across the four grid criteria plus deliverables:
1. Broken or partial features on the live URL.
2. Security checklist failures (highest-impact first: access control, auth, data exposure).
3. Missing deliverables (URL, jury accounts per role, feature recap, demo video).
4. UX gaps (dead ends, missing states, mobile layout).
5. Coherence gaps (isolated features to integrate or hide).
