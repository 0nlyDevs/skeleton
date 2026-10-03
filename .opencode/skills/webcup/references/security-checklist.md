# Webcup Security Checklist

Run this before the feature freeze and again on the **live URL** before delivery. Each item has a quick manual test. Fix in order: access control, authentication, data exposure, then the rest.

## 1. Access control (IDOR, roles)

- [ ] Every non-public route requires authentication. **Test**: call each API route without a cookie/token, expect 401.
- [ ] Every read/update/delete checks ownership server-side. **Test**: log in as user A, request user B's resource by id (`/api/items/<B-id>`), expect 403 or 404.
- [ ] Admin routes check the role server-side. **Test**: call admin endpoints as a normal user, expect 403.
- [ ] Hidden UI is not the only protection. **Test**: open the admin URL directly as a normal user.
- [ ] Users cannot escalate their own role. **Test**: send `{"role":"admin"}` or `{"isAdmin":true}` in profile update and register payloads, verify it is ignored.
- [ ] IDs in URLs cannot be enumerated to leak data (ownership check, or non-sequential ids for public share links).

## 2. Authentication

- [ ] Passwords hashed with argon2id or bcrypt (cost ≥ 12). Never stored or logged in clear.
- [ ] Login error is generic ("Invalid email or password"). Register and password reset do not reveal whether an email exists.
- [ ] Session cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`. **Test**: inspect cookie in devtools.
- [ ] Session id rotated on login; logout destroys the session server-side. **Test**: reuse an old cookie after logout, expect 401.
- [ ] JWT (if used): strong secret from env, short expiry, algorithm pinned, not stored in `localStorage` if avoidable.
- [ ] Password policy: minimum 8 characters (12 preferred), rejects empty/whitespace.
- [ ] Password reset tokens are random, single-use, and expire.

## 3. Brute force & abuse

- [ ] Rate limit on login (per IP and per account), register, password reset, contact forms, and AI endpoints. **Test**: 10 fast failed logins, expect 429 or lockout.
- [ ] Rate limit responses return 429 with a clear message, the UI shows it.
- [ ] Expensive endpoints (search, export, AI) have limits and pagination caps (`limit` max e.g. 100).

## 4. Input validation & injection

- [ ] Schema validation on body, params, and query for every endpoint (types, lengths, enums, formats). Unknown fields stripped.
- [ ] Only parameterized queries/ORM. **Test**: submit `' OR '1'='1` and `"; DROP TABLE` in text fields and search, expect normal behavior.
- [ ] XSS: user content escaped on render. **Test**: create content with `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>`, view it in every place it appears (lists, details, admin, notifications).
- [ ] No `innerHTML` / `dangerouslySetInnerHTML` / `v-html` with user data (or sanitize with DOMPurify).
- [ ] File uploads: allowlist MIME + extension, max size, random filename, stored outside executable paths, served with correct `Content-Type`.
- [ ] Server-side request to user-supplied URLs (SSRF) blocked or allowlisted.
- [ ] Numbers validated for range (no negative quantity/price, no huge values).

## 5. Endpoint protection

- [ ] CSRF protection on state-changing requests when using cookie sessions (SameSite + token or origin check).
- [ ] CORS: explicit allowlist of the app origin; no `Access-Control-Allow-Origin: *` with credentials.
- [ ] Debug, test, seed, and default admin routes removed or disabled in production.
- [ ] HTTP methods restricted (no unintended PUT/DELETE on routes).
- [ ] Directory listing disabled on the web server.

## 6. Data exposure

- [ ] Responses use explicit DTOs. **Test**: inspect network responses for `password`, `hash`, `token`, `resetToken`, other users' emails or private fields.
- [ ] Production errors return a generic message; no stack traces, SQL errors, or file paths. **Test**: send malformed JSON and invalid ids.
- [ ] Not publicly reachable: `/.env`, `/.git/`, `/backup.sql`, `/*.map`, `/phpinfo.php`, `/node_modules/`. **Test**: request each on the live domain, expect 404.
- [ ] Secrets only in environment variables; `.env` in `.gitignore`; no keys in client bundles. **Test**: search built JS for `sk-`, `API_KEY`, `SECRET`.
- [ ] Logs do not contain passwords or tokens.

## 7. Transport & headers

- [ ] HTTPS enforced, HTTP redirects to HTTPS.
- [ ] Headers present: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`. **Test**: `curl -I https://<app>`.
- [ ] `X-Powered-By` and server version banners removed.

## 8. Dependencies & config

- [ ] `npm audit` / `pnpm audit` / `pip-audit` / `composer audit`: no critical issues.
- [ ] Framework in production mode (debug off).
- [ ] Default credentials changed; jury demo accounts have strong unique passwords.
- [ ] DB not exposed publicly; DB user has least privileges needed.

## 9. AI features (if any)

- [ ] AI route authenticated and rate limited.
- [ ] Prompt injection limited: system prompt server-side, user input clearly delimited, model output treated as untrusted (escaped on render, never executed, never used to authorize actions).
- [ ] Timeout + fallback model + friendly error; the core app works when AI is down.

## Quick live-URL smoke script (adapt)

```bash
APP=https://your-app.example
curl -sI "$APP" | grep -iE 'strict-transport|content-security|x-content-type|x-frame|referrer'
for p in .env .git/config backup.sql phpinfo.php; do printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "$APP/$p"; done
curl -s -o /dev/null -w "unauth API: %{http_code}\n" "$APP/api/me"
for i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code} " -X POST "$APP/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"a@a.a","password":"wrong"}'; done; echo
```
