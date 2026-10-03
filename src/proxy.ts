/**
 * Request proxy (Next.js 16's replacement for `middleware.ts`).
 *
 * It sits at `src/proxy.ts` — the same level as `app` — because that is the only
 * location Next 16 registers for a project that keeps its routes under `src/`.
 * A root-level `middleware.ts` is no longer picked up in development, which
 * meant the file ran in production and not in dev: precisely the situation in
 * which its bugs stay invisible until deploy.
 *
 * Three jobs, in order of importance:
 *
 *   1. **Block sensitive-path probes.** `/.env`, `/.git/config` and `/backup.sql`
 *      must 404 on the deployed host. On cPanel the application root can end up
 *      web-reachable if the docroot is misconfigured, so this is a real control
 *      rather than a formality — and it is one of the stated quality gates.
 *   2. **Attach a per-request Content-Security-Policy with a fresh nonce.** The
 *      nonce is generated here and handed to Next on the request headers; Next
 *      stamps it onto its own inline bootstrap scripts.
 *   3. **Redirect unauthenticated traffic away from the app area.**
 *
 * On that last point: this proxy *cannot* authorize. It only checks that a
 * session cookie is present, and it deliberately does not touch `/api/*` — the
 * correct answer to an unauthenticated API call is the JSON `401` from
 * `lib/api/route.ts`, not a redirect to an HTML login page. Redirecting API
 * routes also breaks the endpoints that legitimately have no session at all:
 * sign-in, sign-up, password reset and the secret-authenticated cron job.
 * Every protected page re-resolves the session server-side.
 */

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env.public";

/** Reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = new Set([
  "/",
  "/feed",
  "/privacy",
  "/terms",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/2fa",
  "/sw.js",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
]);

/** Readable without an account (content-level rules still apply server-side). */
const PUBLIC_PREFIXES = ["/feed/", "/profile/", "/groups", "/u/", "/search", "/map", "/p/", "/pages"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Redirected away from when a session already exists. */
const GUEST_ONLY_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  // The 2FA challenge sits between password and session: a visitor who already
  // holds a session cookie has nothing to verify.
  "/2fa",
]);

/**
 * Prefixes that are always passed straight through.
 *
 * `/api` is authenticated (or not) by the route wrapper; `/api/auth/*` must stay
 * reachable with no session or nobody could ever sign in.
 */
const PASS_THROUGH_PREFIXES = ["/api/", "/_next/"];

/**
 * Paths that must never be served, whatever the host configuration.
 * Matched case-insensitively against the decoded pathname.
 */
const SENSITIVE_PATH_PATTERNS: readonly RegExp[] = [
  /\/\.env(\..*)?$/i,
  /\/\.git(\/|$)/i,
  /\/\.gitignore$/i,
  /\/\.htaccess$/i,
  /\/\.ssh(\/|$)/i,
  /\/\.aws(\/|$)/i,
  /\/\.well-known\/\.\./i,
  /\/wp-(login|admin|config)\b/i,
  /\/xmlrpc\.php$/i,
  /\/(backup|dump|db|database)[-_.]?\d*\.(sql|sql\.gz|zip|tar|gz|bak)$/i,
  /\/(composer\.(json|lock)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
  /\/\.DS_Store$/i,
  /\/\.vscode(\/|$)/i,
  /\/\.claude(\/|$)/i,
  /\/\.agents(\/|$)/i,
];

function isSensitivePath(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A malformed escape is itself suspicious; test the raw value.
  }
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(decoded));
}

function isPassThrough(pathname: string): boolean {
  return PASS_THROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * The WebSocket origin for the CSP, from configuration rather than the request.
 *
 * Three constraints, and the value has to satisfy all of them:
 *
 * 1. **Not the request.** `request.nextUrl.host` is not reliable behind
 *    Passenger — on the live host it resolved to the bind address
 *    (`0.0.0.0:3000`) instead of the public domain, so the production policy
 *    carried `connect-src ... wss://0.0.0.0:3000` and every socket was blocked.
 *    The app survived on the polling fallback, which is why it presented as a
 *    realtime problem rather than a policy problem. It is also attacker-
 *    controllable: a spoofed `Host` could otherwise widen `connect-src` to a
 *    socket server of the attacker's choosing, which is exactly what the
 *    same-host restriction exists to prevent.
 *
 * 2. **Read at runtime, not baked in.** `NEXT_PUBLIC_*` is inlined into the
 *    bundle by Next at build time, so `publicEnv.appUrl` cannot be corrected by
 *    changing the variable on a running server. `BETTER_AUTH_URL` is a plain
 *    runtime variable and names the same origin.
 *
 * 3. **Safe on a runtime that has no `process.env`.** On an edge runtime the
 *    fallback is the baked public value, which is still better than the Host
 *    header.
 *
 * Returns "" when nothing usable is configured, leaving `connect-src 'self'`
 * alone: a broken origin must not widen the policy, and same-origin is correct
 * for everything except the socket.
 */
export function socketOrigin(isDev: boolean): string {
  const candidate = (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    publicEnv.appUrl
  ).trim();

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    // Plain `ws:` in production is blocked by `upgrade-insecure-requests`
    // anyway; a dev-only `ws:` is what keeps the local server working.
    const scheme = url.protocol === "https:" ? "wss:" : isDev ? "ws:" : "wss:";
    return `${scheme}//${url.host}`;
  } catch {
    return "";
  }
}

function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Turbopack's dev runtime evaluates generated code; production does not.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  const socket = socketOrigin(isDev);

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Inline styles are required: Next inlines critical CSS and Tailwind's
    // runtime injects style tags.
    "style-src 'self' 'unsafe-inline'",
    // OpenStreetMap tiles for maps; provider avatars for OAuth accounts.
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://tile.openstreetmap.org",
    "font-src 'self' data:",
    // `ws:`/`wss:` for Socket.IO; the app is otherwise same-origin.
    // Sockets to this origin only (any-host `ws:` would let injected code
    // exfiltrate to an attacker's socket server).
    `connect-src 'self'${socket ? ` ${socket}` : ""}`,
    "media-src 'self'",
    // Video blocks on user pages: privacy-enhanced players only, loaded on click.
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV !== "production";

  if (isSensitivePath(pathname)) {
    // Indistinguishable from any other missing file.
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the policy from the *request* to pick up the nonce.
  requestHeaders.set("Content-Security-Policy", csp);

  if (isPassThrough(pathname)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const hasSession = Boolean(getSessionCookie(request));

  if (hasSession && GUEST_ONLY_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!hasSession && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // `next` is validated by the login form before use, so it cannot become an
    // open redirect.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's static output and the favicon. API routes are
     * included so they still get probe blocking and a CSP header; they return
     * from `isPassThrough` before any session check.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
