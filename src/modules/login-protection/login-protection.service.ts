/**
 * Visible brute-force protection on sign-in.
 *
 * The limiter itself lives in the BetterAuth pipeline (`auth-hooks.ts`). This
 * module adds what makes it perceptible without getting in the way of a
 * resident who mistyped a password:
 *
 *  * after each failed attempt, the form learns how many tries remain and, on
 *    the last one, how long the pause lasts (response headers);
 *  * every failure leaves a trace in the audit log, so the account owner sees
 *    attempts on their account and administrators see a wave across accounts;
 *  * a failed-only counter per IP spans every account and is never cleared by a
 *    successful sign-in, which stops credential stuffing over many accounts;
 *  * when an account locks, its owner gets one alert (in-app and email) per
 *    hour, never one per attempt.
 *
 * Counters are keyed on the submitted identifier whether or not an account
 * exists, so the answers never reveal which addresses are registered.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { RATE_LIMITS, hashIdentifier, inspectLimit, rateLimitKey, recordLimit, type RateLimitResult } from "@/lib/rate-limit";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createNotification } from "../notifications/notifications.service";

export const SIGN_IN_PATHS = ["/sign-in/email", "/sign-in/username"] as const;
export type SignInPath = (typeof SIGN_IN_PATHS)[number];

export function isSignInPath(path: string): path is SignInPath {
  return (SIGN_IN_PATHS as readonly string[]).includes(path);
}

/** Header carrying the attempts left before the pause, on a failed sign-in. */
export const ATTEMPTS_REMAINING_HEADER = "X-Login-Attempts-Remaining";

export function accountCounterKey(path: string, account: string): string {
  return rateLimitKey(`auth:${path}:account`, account.trim().toLowerCase());
}

export function ipCounterKey(path: string, ip: string): string {
  return rateLimitKey(`auth:${path}:ip`, ip);
}

function ipFailuresKey(ip: string): string {
  return rateLimitKey("auth:sign-in-failures:ip", ip);
}

/** The cross-account failure budget of an IP, read without consuming it. */
export async function inspectIpFailures(ip: string): Promise<RateLimitResult> {
  return inspectLimit({ key: ipFailuresKey(ip), rule: RATE_LIMITS.loginFailuresPerIp });
}

export interface FailedSignInInput {
  readonly path: SignInPath;
  /** The email or username as submitted. */
  readonly account: string | undefined;
  readonly ip: string;
}

export interface FailedSignInOutcome {
  readonly remaining: number;
  readonly locked: boolean;
  readonly retryAfterSeconds: number;
}

async function findTargetUser(path: SignInPath, account: string) {
  const identifier = account.trim().toLowerCase();
  if (!identifier) return null;
  return prisma.user.findUnique({
    where: path === "/sign-in/email" ? { email: identifier } : { username: identifier },
    select: { id: true },
  });
}

async function notifyLockout(userId: string, retryAfterSeconds: number): Promise<void> {
  const notice = { key: rateLimitKey("auth:lockout-notice", userId), rule: RATE_LIMITS.lockoutNotice };
  if (!(await inspectLimit(notice)).allowed) return;
  await recordLimit(notice);

  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  await createNotification({
    userId,
    type: "SECURITY",
    title: "Connexion à votre compte suspendue par sécurité",
    body: `Plusieurs mots de passe erronés ont été saisis pour votre compte. La connexion est suspendue pendant ${minutes} min. Votre mot de passe n'a pas été divulgué. Si ce n'était pas vous, activez la double authentification ; sinon, attendez ou réinitialisez votre mot de passe.`,
    link: "/settings/security?alert=locked",
    email: true,
  });
}

/**
 * Called once per rejected password (never on a 429). Never throws: the
 * resident must still get their "invalid email or password" answer.
 */
export async function recordFailedSignIn(input: FailedSignInInput): Promise<FailedSignInOutcome | null> {
  try {
    const ipFailures = await recordLimit({ key: ipFailuresKey(input.ip), rule: RATE_LIMITS.loginFailuresPerIp });
    const perAccount = input.account
      ? await inspectLimit({ key: accountCounterKey(input.path, input.account), rule: RATE_LIMITS.login })
      : null;

    const counters = [ipFailures, ...(perAccount ? [perAccount] : [])];
    const remaining = Math.min(...counters.map((counter) => counter.remaining));
    const exhausted = counters.filter((counter) => counter.remaining === 0);
    const locked = exhausted.length > 0;
    const retryAfterSeconds = locked ? Math.max(...exhausted.map((counter) => counter.retryAfterSeconds)) : 0;

    const target = input.account ? await findTargetUser(input.path, input.account) : null;
    const accountLocked = perAccount?.remaining === 0;
    const trace = {
      targetType: target ? "user" : "sign_in_identifier",
      targetId: target ? target.id : hashIdentifier((input.account ?? "").trim().toLowerCase()),
      ip: input.ip,
    };

    await recordAudit({
      ...trace,
      action: auditActions.signInFailed,
      metadata: { method: input.path === "/sign-in/email" ? "email" : "username", remaining, locked },
    });
    if (accountLocked) {
      await recordAudit({ ...trace, action: auditActions.signInLocked, metadata: { retryAfterSeconds } });
      if (target) await notifyLockout(target.id, retryAfterSeconds);
    }

    return { remaining, locked, retryAfterSeconds };
  } catch (error) {
    logger.warn("failed sign-in bookkeeping failed", { path: input.path, error });
    return null;
  }
}
