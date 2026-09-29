/**
 * CSRF defence for state-changing requests.
 *
 * BetterAuth protects its own endpoints; this covers the application's
 * `/api/*` route handlers. Two mechanisms make cookie-session CSRF impossible
 * in practice:
 *   * `SameSite=Lax` on the session cookie (set by BetterAuth), and
 *   * this origin check, which the browser cannot forge from a cross-site page.
 *
 * The check only applies when the request actually carries cookies. A request
 * with no `Cookie` header cannot be a cross-site forgery — there is no ambient
 * authority to abuse — so non-browser API clients keep working.
 */

import { ForbiddenError } from "@/lib/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reduce a URL to its scheme + host + port, or `undefined` when unparseable. */
export function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

export function isTrustedOrigin(
  origin: string | null,
  allowedOrigins: readonly string[],
): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return allowedOrigins
    .map((allowed) => normalizeOrigin(allowed))
    .some((allowed) => allowed !== undefined && allowed === normalized);
}

/**
 * Throws `ForbiddenError` when a state-changing, cookie-bearing request did not
 * originate from an allowlisted origin.
 */
export function assertTrustedOrigin(
  request: Request,
  allowedOrigins: readonly string[],
): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  if (!request.headers.get("cookie")) return;

  const origin =
    request.headers.get("origin") ?? request.headers.get("referer") ?? null;

  if (!origin) {
    throw new ForbiddenError("This request is missing an Origin header.");
  }

  if (!isTrustedOrigin(origin, allowedOrigins)) {
    throw new ForbiddenError("This request originated from an untrusted origin.");
  }
}
