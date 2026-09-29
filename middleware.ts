/**
 * Edge middleware.
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
 * On that last point: this middleware *cannot* authorize. It runs on the edge
 * runtime and has no database, so it only checks that a session cookie exists.
 * It is a redirect for humans, not a security boundary — every protected page
 * re-resolves the session server-side and every API route enforces roles in
 * `lib/api/route.ts`. Deleting this file would make the app less pleasant, not
 * less safe.
 */

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = new Set([
  "/",
  "/privacy",
  "/terms",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/2fa",
]);

/** Redirected away from when a session already exists. */
const GUEST_ONLY_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

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

function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Turbopack's dev runtime evaluates generated code; production does not.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Inline styles are required: Next inlines critical CSS and Tailwind's
    // runtime injects style tags.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    // `ws:`/`wss:` for Socket.IO; the app is otherwise same-origin.
    "connect-src 'self' ws: wss:",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(request: NextRequest): NextResponse {
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

  const hasSession = Boolean(getSessionCookie(request));

  if (hasSession && GUEST_ONLY_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!hasSession && !PUBLIC_PATHS.has(pathname)) {
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
     * included: they benefit from the probe blocking, and their own headers come
     * from `next.config.ts`.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
