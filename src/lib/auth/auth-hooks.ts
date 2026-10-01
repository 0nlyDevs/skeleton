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
import { findPasswordViolation } from "@/lib/auth/password-policy";
import {
  birthDateViolation,
  composeDisplayName,
  parseBirthDate,
  personNameViolation,
  usernameViolation,
} from "@/lib/validation/profile";
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
  { path: "/sign-in/username", rule: RATE_LIMITS.login, byAccount: true },
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

/** The account identifier a sign-in names: the email, or the username. */
function readSubmittedAccount(ctx: unknown): string | undefined {
  const email = readSubmittedEmail(ctx);
  if (email) return email;

  const body = (ctx as HookContextView).body;
  if (typeof body !== "object" || body === null) return undefined;
  const username = (body as { username?: unknown }).username;
  return typeof username === "string" && username.length > 0 ? username : undefined;
}

function readBodyString(ctx: unknown, key: string): string | undefined {
  const body = (ctx as HookContextView).body;
  if (typeof body !== "object" || body === null) return undefined;

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Endpoints that accept a new password, and the body field carrying it.
 * BetterAuth only knows a length rule, so the full policy is applied here — on
 * the pipeline itself, so calling `/api/auth/*` directly cannot skip it.
 */
export const PASSWORD_FIELDS: Readonly<Record<string, string>> = {
  "/sign-up/email": "password",
  "/reset-password": "newPassword",
  "/change-password": "newPassword",
  "/set-password": "newPassword",
};

function enforcePasswordPolicy(ctx: unknown, path: string): void {
  const field = PASSWORD_FIELDS[path];
  if (!field) return;

  const password = readBodyString(ctx, field);
  // A missing field is BetterAuth's own 400 to raise.
  if (password === undefined) return;

  const violation = findPasswordViolation(password, {
    email: readSubmittedEmail(ctx),
    username: readBodyString(ctx, "username"),
  });

  if (violation) {
    throw new APIError("BAD_REQUEST", { message: violation, code: "PASSWORD_TOO_WEAK" });
  }
}

function badRequest(field: string, message: string): never {
  throw new APIError("BAD_REQUEST", { message, code: `INVALID_${field.toUpperCase()}` });
}

/**
 * Sign-up requires the full identity: username, first and last name, birth
 * date. The display `name` is derived from the two name parts here, so a
 * client cannot submit a display name that disagrees with them.
 */
function enforceSignUpProfile(ctx: unknown): void {
  const body = (ctx as HookContextView).body;
  if (typeof body !== "object" || body === null) return;
  const fields = body as Record<string, unknown>;

  const username = typeof fields.username === "string" ? fields.username : "";
  const firstName = typeof fields.firstName === "string" ? fields.firstName : "";
  const lastName = typeof fields.lastName === "string" ? fields.lastName : "";
  const birthDate = typeof fields.birthDate === "string" ? fields.birthDate : "";

  const usernameError = usernameViolation(username);
  if (usernameError) badRequest("username", usernameError);
  const firstNameError = personNameViolation(firstName);
  if (firstNameError) badRequest("first_name", firstNameError);
  const lastNameError = personNameViolation(lastName);
  if (lastNameError) badRequest("last_name", lastNameError);
  const birthDateError = birthDateViolation(birthDate);
  if (birthDateError) badRequest("birth_date", birthDateError);

  fields.firstName = firstName.trim().replace(/\s+/g, " ");
  fields.lastName = lastName.trim().replace(/\s+/g, " ");
  fields.name = composeDisplayName(firstName, lastName);
  fields.birthDate = parseBirthDate(birthDate);
  // Casing is kept for display; the plugin stores the lowercase handle.
  fields.displayUsername = username.trim();
}

/**
 * BetterAuth endpoints this application replaces with its own audited,
 * validated API. Left open, `/update-user` would accept an arbitrary-length
 * name or an external image URL (a tracking beacon) straight from the client.
 */
const DISABLED_PATHS = new Set(["/update-user"]);

/**
 * The single `hooks.before` entry: disabled endpoints, then input policy (a
 * typo must not burn the sign-up budget), then the brute-force limiter.
 */
export const authBeforeHook: AuthBeforeMiddleware = async (ctx) => {
  const path = readPath(ctx);
  if (!path) return;

  if (DISABLED_PATHS.has(path)) {
    throw new APIError("NOT_FOUND", { message: "Not found.", code: "NOT_FOUND" });
  }

  if (path === "/sign-up/email") enforceSignUpProfile(ctx);
  enforcePasswordPolicy(ctx, path);
  await authRateLimitHook(ctx);
};

export const authRateLimitHook: AuthBeforeMiddleware = async (ctx) => {
  const path = readPath(ctx);
  if (!path) return;

  const guard = GUARDED_AUTH_PATHS.find((entry) => entry.path === path);
  if (!guard) return;

  const headers = readHeaders(ctx);
  const ip = headers ? resolveClientIp(headers, env.trustProxy) : "unknown";

  const checks = [{ key: rateLimitKey(`auth:${path}:ip`, ip), rule: guard.rule }];

  const email = guard.byAccount ? readSubmittedAccount(ctx) : undefined;
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
