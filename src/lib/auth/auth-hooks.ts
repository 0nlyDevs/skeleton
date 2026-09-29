/**
 * BetterAuth pipeline hooks.
 *
 * Rate limiting on authentication lives *inside* BetterAuth's dispatch chain
 * rather than in front of it. That matters: BetterAuth exposes its endpoints at
 * `/api/auth/*`, so a limiter implemented in a wrapper route or in the UI would
 * be trivially bypassed by calling `/api/auth/sign-in/email` directly. A
 * `hooks.before` guard runs for every request that reaches the pipeline,
 * whichever door it came through.
 *
 * The hook receives the fully parsed body (verified against better-auth 1.7), so
 * the limit can key on the submitted email as well as the source IP — the
 * "per account **and** per IP" rule the contest brief asks for.
 *
 * Counters are only *recorded* here; they are cleared when a session is actually
 * created (see `databaseHooks.session.create.after` in `auth.ts`), so successful
 * sign-ins never consume the budget and only failures accumulate.
 */

import { APIError } from "better-auth/api";
import type { BetterAuthOptions } from "better-auth";

import { env } from "@/lib/env";
import { resolveClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey, type RateLimitRule } from "@/lib/rate-limit";

type AuthBeforeMiddleware = NonNullable<NonNullable<BetterAuthOptions["hooks"]>["before"]>;

interface GuardedPath {
  /** Path as BetterAuth reports it to the hook — no `/api/auth` prefix. */
  readonly path: string;
  readonly rule: RateLimitRule;
  /** Add a second counter keyed on the submitted email address. */
  readonly byAccount: boolean;
}

/**
 * Exported so the guard table is testable and greppable. Every entry answers
 * "which identifier would an attacker vary?" — the IP for volumetric abuse, the
 * account for targeted brute force.
 */
export const GUARDED_AUTH_PATHS: readonly GuardedPath[] = [
  { path: "/sign-in/email", rule: RATE_LIMITS.login, byAccount: true },
  { path: "/sign-up/email", rule: RATE_LIMITS.register, byAccount: true },
  { path: "/request-password-reset", rule: RATE_LIMITS.passwordReset, byAccount: true },
  { path: "/send-verification-email", rule: RATE_LIMITS.emailVerification, byAccount: true },
  { path: "/two-factor/verify-totp", rule: RATE_LIMITS.twoFactor, byAccount: false },
  { path: "/two-factor/verify-backup-code", rule: RATE_LIMITS.twoFactor, byAccount: false },
];

/**
 * The hook context is typed as an input-shape union upstream, but at runtime it
 * is the full middleware context. These readers narrow it defensively instead of
 * casting to `any`, so a future upstream change degrades to "guard skipped"
 * rather than a crash on every auth request.
 */
interface HookContextView {
  path?: unknown;
  body?: unknown;
  headers?: unknown;
  request?: { url?: unknown };
}

function readPath(ctx: unknown): string | undefined {
  const view = ctx as HookContextView;
  if (typeof view.path === "string") return view.path;

  const url = view.request?.url;
  if (typeof url === "string") {
    try {
      return new URL(url).pathname.replace(/^\/api\/auth/, "");
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function readHeaders(ctx: unknown): Headers | undefined {
  const headers = (ctx as HookContextView).headers;
  return headers instanceof Headers ? headers : undefined;
}

function readSubmittedEmail(ctx: unknown): string | undefined {
  const body = (ctx as HookContextView).body;
  if (typeof body !== "object" || body === null) return undefined;

  const email = (body as { email?: unknown }).email;
  return typeof email === "string" && email.length > 0 ? email : undefined;
}

export const authRateLimitHook: AuthBeforeMiddleware = async (ctx) => {
  const path = readPath(ctx);
  if (!path) return;

  const guard = GUARDED_AUTH_PATHS.find((entry) => entry.path === path);
  if (!guard) return;

  const headers = readHeaders(ctx);
  const ip = headers ? resolveClientIp(headers, env.trustProxy) : "unknown";

  const checks = [{ key: rateLimitKey(`auth:${path}:ip`, ip), rule: guard.rule }];

  const email = guard.byAccount ? readSubmittedEmail(ctx) : undefined;
  if (email) {
    checks.push({
      key: rateLimitKey(`auth:${path}:account`, email.trim().toLowerCase()),
      rule: guard.rule,
    });
  }

  try {
    await enforceThenRecord(checks);
  } catch (error) {
    const retryAfterSeconds =
      error instanceof Error && "retryAfterSeconds" in error
        ? Number((error as { retryAfterSeconds: unknown }).retryAfterSeconds)
        : guard.rule.windowMs / 1000;

    // Re-thrown in BetterAuth's own error shape so the client receives a real
    // 429 with a Retry-After header instead of a 500.
    throw new APIError(429, {
      message: "Too many attempts. Please wait and try again.",
      code: "TOO_MANY_REQUESTS",
    }, {
      "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
    });
  }
};
