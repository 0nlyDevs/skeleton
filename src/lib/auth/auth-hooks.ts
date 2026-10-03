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

import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import type { BetterAuthOptions } from "better-auth";

import { env } from "@/lib/env";
import { resolveClientIp } from "@/lib/http/client-ip";
import { BREACHED_PASSWORD_MESSAGE, isBreachedPassword } from "@/lib/auth/breached-passwords";
import { findPasswordViolation } from "@/lib/auth/password-policy";
import { encryptField } from "@/lib/crypto/field-encryption";
import { auditActions } from "@/modules/audit/audit.schema";
import { recordAudit } from "@/modules/audit/audit.service";
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, isDeviceId, newDeviceId, recordSignIn } from "@/modules/devices/devices.service";
import { createNotification } from "@/modules/notifications/notifications.service";
import { clearMustSetSecret } from "@/modules/assisted-accounts/assisted-accounts.service";
import { prisma } from "@/lib/db/prisma";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "@/lib/i18n/config";
import {
  birthDateViolation,
  composeDisplayName,
  formatBirthDate,
  parseBirthDate,
  personNameViolation,
  usernameViolation,
} from "@/lib/validation/profile";
import { RateLimitedError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, type RateLimitRule } from "@/lib/rate-limit";
import {
  ATTEMPTS_REMAINING_HEADER,
  accountCounterKey,
  ipCounterKey,
  inspectIpFailures,
  isSignInPath,
  recordFailedSignIn,
} from "@/modules/login-protection/login-protection.service";

type AuthBeforeMiddleware = NonNullable<NonNullable<BetterAuthOptions["hooks"]>["before"]>;

interface GuardedPath {
  /** Path as BetterAuth reports it to the hook — no `/api/auth` prefix. */
  readonly path: string;
  readonly rule: RateLimitRule;
  /** Add a second counter keyed on the submitted email address. */
  readonly byAccount: boolean;
  /**
   * Count every attempt per IP. Off for sign-in: there the IP budget counts
   * failures only, across accounts (`loginFailuresPerIp`), so one resident's
   * typos never lock out everyone behind the same home or office network.
   */
  readonly byIp: boolean;
}

/**
 * Exported so the guard table is testable and greppable. Every entry answers
 * "which identifier would an attacker vary?" — the IP for volumetric abuse, the
 * account for targeted brute force.
 */
export const GUARDED_AUTH_PATHS: readonly GuardedPath[] = [
  { path: "/sign-in/email", rule: RATE_LIMITS.login, byAccount: true, byIp: false },
  { path: "/sign-in/username", rule: RATE_LIMITS.login, byAccount: true, byIp: false },
  { path: "/sign-up/email", rule: RATE_LIMITS.register, byAccount: true, byIp: true },
  { path: "/request-password-reset", rule: RATE_LIMITS.passwordReset, byAccount: true, byIp: true },
  { path: "/send-verification-email", rule: RATE_LIMITS.emailVerification, byAccount: true, byIp: true },
  { path: "/two-factor/verify-totp", rule: RATE_LIMITS.twoFactor, byAccount: false, byIp: true },
  { path: "/two-factor/verify-backup-code", rule: RATE_LIMITS.twoFactor, byAccount: false, byIp: true },
  // D02 — passkey sign-in: same budget as a password attempt, per source IP
  // (the request names no account until the device has signed the challenge).
  { path: "/passkey/generate-authenticate-options", rule: RATE_LIMITS.login, byAccount: false, byIp: true },
  { path: "/passkey/verify-authentication", rule: RATE_LIMITS.login, byAccount: false, byIp: true },
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

async function enforcePasswordPolicy(ctx: unknown, path: string): Promise<void> {
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
  if (await isBreachedPassword(password)) {
    throw new APIError("BAD_REQUEST", { message: BREACHED_PASSWORD_MESSAGE, code: "PASSWORD_BREACHED" });
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
  // Encrypted at rest; the plaintext column is never written.
  fields.birthDateEncrypted = encryptField(formatBirthDate(parseBirthDate(birthDate)) ?? "");
  delete fields.birthDate;
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
  await enforcePasswordPolicy(ctx, path);
  await authRateLimitHook(ctx);
};

export const authRateLimitHook: AuthBeforeMiddleware = async (ctx) => {
  const path = readPath(ctx);
  if (!path) return;

  const guard = GUARDED_AUTH_PATHS.find((entry) => entry.path === path);
  if (!guard) return;

  const headers = readHeaders(ctx);
  const ip = headers ? resolveClientIp(headers, env.trustProxy) : "unknown";

  const checks = guard.byIp ? [{ key: ipCounterKey(path, ip), rule: guard.rule }] : [];

  const email = guard.byAccount ? readSubmittedAccount(ctx) : undefined;
  if (email) checks.push({ key: accountCounterKey(path, email), rule: guard.rule });

  try {
    // An IP that keeps failing across many accounts is paused even when each
    // single account stays under its own limit (credential stuffing).
    if (isSignInPath(path)) {
      const failures = await inspectIpFailures(ip);
      if (!failures.allowed) throw new RateLimitedError(failures.retryAfterSeconds);
    }
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

type AfterHookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * A rejected password (401 from a sign-in endpoint): count it and tell the
 * form how many attempts remain, so the pause never comes as a surprise.
 */
async function reportFailedSignIn(ctx: AfterHookContext): Promise<void> {
  const path = readPath(ctx);
  if (!path || !isSignInPath(path)) return;

  const returned = ctx.context.returned;
  if (!isAPIError(returned) || returned.statusCode !== 401) return;

  const headers = readHeaders(ctx);
  const outcome = await recordFailedSignIn({
    path,
    account: readSubmittedAccount(ctx),
    ip: headers ? resolveClientIp(headers, env.trustProxy) : "unknown",
  });
  if (!outcome) return;

  ctx.setHeader(ATTEMPTS_REMAINING_HEADER, String(outcome.remaining));
  if (outcome.locked) ctx.setHeader("Retry-After", String(Math.max(1, outcome.retryAfterSeconds)));
}

/**
 * D02 — adding or removing a passkey changes how the account can be entered:
 * it is written to the audit trail and the owner is told at once (in the app
 * and by email), so a passkey added by someone else does not go unnoticed.
 */
async function afterPasskeyChange(ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]): Promise<void> {
  const added = ctx.path === "/passkey/verify-registration";
  const removed = ctx.path === "/passkey/delete-passkey";
  if (!added && !removed) return;
  if (ctx.context.returned instanceof APIError) return;
  const userId = ctx.context.session?.user?.id;
  if (!userId) return;
  // F71 — a passkey replaces the printed access code as the way in.
  if (added) await clearMustSetSecret(String(userId));
  const ip = ctx.headers ? resolveClientIp(ctx.headers, env.trustProxy) : null;
  await recordAudit({
    actorId: String(userId),
    action: added ? auditActions.passkeyAdded : auditActions.passkeyRemoved,
    targetType: "user",
    targetId: String(userId),
    ip,
  });
  await createNotification({
    userId: String(userId),
    type: "SECURITY",
    title: added ? "Une nouvelle passkey a été ajoutée à votre compte" : "Une passkey a été retirée de votre compte",
    body: added
      ? "Vous pouvez désormais vous connecter avec le visage, l'empreinte ou le code de cet appareil. Si ce n'est pas vous, supprimez-la et changez votre mot de passe."
      : "Cet appareil ne permet plus de se connecter sans mot de passe. Si ce n'est pas vous, changez votre mot de passe.",
    link: "/settings/security",
    email: true,
  });
}

/**
 * After any endpoint that just created a session (password, username, OAuth
 * callback, 2FA completion): tag the browser with a device cookie and alert
 * the owner when the device is new.
 */
export const authAfterHook = createAuthMiddleware(async (ctx) => {
  await afterPasskeyChange(ctx);
  await reportFailedSignIn(ctx);

  const created = ctx.context.newSession;
  if (!created) return;

  const existing = ctx.getCookie(DEVICE_COOKIE);
  const deviceId = isDeviceId(existing) ? existing : newDeviceId();

  await recordSignIn({
    userId: String(created.user.id),
    deviceId,
    userAgent: typeof created.session.userAgent === "string" ? created.session.userAgent : null,
    ip: typeof created.session.ipAddress === "string" ? created.session.ipAddress : null,
  });

  // F71 — open the interface in the language chosen for the resident.
  const preferred = await prisma.user
    .findUnique({ where: { id: String(created.user.id) }, select: { preferredLocale: true } })
    .then((row) => row?.preferredLocale ?? null)
    .catch(() => null);
  if (isLocale(preferred)) {
    ctx.setCookie(LOCALE_COOKIE, preferred, { path: "/", sameSite: "lax", maxAge: LOCALE_COOKIE_MAX_AGE, secure: env.isProduction });
  }

  ctx.setCookie(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
});
