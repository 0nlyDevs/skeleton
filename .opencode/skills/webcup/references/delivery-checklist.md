# Webcup Delivery Checklist (wrap-up before the deadline)

Only what is delivered and online at closing is evaluated. The jury tests later, alone, with what you give them. Make that experience flawless.

## Mandatory deliverables

- [ ] **Application URL**: live, HTTPS, loads fast, no console errors, works on mobile and desktop.
- [ ] **Jury access**: one account **per role** (e.g. user, admin, other roles), strong unique passwords, pre-filled with realistic demo data so every feature has something to show. Accounts must unlock every feature that needs authentication.
- [ ] **Feature recap** (from `FEATURES.md`): what is implemented, how to reach it, which role, status.
- [ ] **Demo video**: short, shows the app, its logic, and main features.

## Feature recap template

```markdown
# <App name> — Feature recap

URL: https://...
Jury accounts:
| Role | Email | Password |
|---|---|---|
| Admin | jury-admin@... | ... |
| User  | jury-user@...  | ... |

## Base features
| # | Feature | Status | Where / how to test | Role |
|---|---|---|---|---|
| 1 | ... | Done | Menu > ... | User |

## Additional features (announced during the 24h)
| # | Feature | Status | Where / how to test | Role | Note |
|---|---|---|---|---|---|
| A1 | ... | Done | ... | ... | |
| A2 | ... | Skipped | — | — | Prioritized security hardening instead |

## Technical & security highlights
- Architecture: ...
- Security: hashed passwords (argon2id), server-side access control on every route, input validation, rate limiting on login, security headers, no secret exposure.
- Robustness: error handling, fallbacks on external APIs, pagination, caching.
```

Include skipped/partial features with a one-line reason: it shows deliberate prioritization, which the format rewards.

## Demo video plan (keep it short, target 2–4 minutes)

1. 10 s: app name, problem it solves, target user.
2. Main user flow end to end with real data.
3. Each additional feature, fast.
4. Admin/role-specific flows.
5. 20 s: technical and security highlights (show a 403 on another user's resource, a 429 on brute force, validation errors).
6. Close on the app URL.

Record on the **deployed** app, not localhost. Readable resolution, no personal notifications on screen, no secrets visible.

## Final walkthrough (do it as the jury would)

- [ ] Open the URL in a private window. Log in with each jury account.
- [ ] Follow the feature recap line by line; every "Done" item works exactly as written.
- [ ] Try bad inputs on each form: empty, too long, script tags. Clean errors, no crash.
- [ ] Mobile width 390px: no horizontal scroll, nav usable.
- [ ] No placeholder text (lorem ipsum), no dead links, no "coming soon" buttons.
- [ ] Security smoke script from `security-checklist.md` passes on the live domain.
- [ ] Seed/demo data looks realistic and consistent with the theme.
- [ ] Last deploy done, verified, and **no more deploys** close to the deadline unless fixing a blocker.

## Keep it alive during evaluation (J+1 → J+X)

The jury tests days after the deadline. The app must still work, unchanged.

- [ ] Hosting does not sleep, expire, or hit a free-tier limit during the evaluation days.
- [ ] No deploys or code changes after H+24 — work after the deadline is not considered and can look like cheating.
- [ ] Jury sessions last long enough, or re-login is easy; jury passwords do not expire.
- [ ] Jury actions cannot destroy the demo: one juror deleting or editing data must not break another juror's test (separate accounts per juror if possible, or protected demo records).
- [ ] DB backup taken at H+24; a restore procedure exists in case the demo data gets corrupted.
- [ ] External API keys and AI quotas stay valid through the evaluation period; the app degrades gracefully if a quota runs out (clear message, core flows still work).
- [ ] TLS certificate and domain stay valid.
