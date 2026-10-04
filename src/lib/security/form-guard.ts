/**
 * F81 — protection against robots that fill forms automatically, without a
 * puzzle for people. Three quiet checks:
 *
 *   - a signed token the page asks for when the form opens (a script posting
 *     straight to the API has none);
 *   - the time between opening and sending (a robot answers in milliseconds);
 *   - a hidden field people never see and robots fill.
 *
 * A blocked attempt is counted, so administrators see the protection work.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { BadRequestError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Faster than a person can read and fill a form. */
const MIN_AGE_MS = 2_500;
const MAX_AGE_MS = 3 * 60 * 60_000;

function sign(payload: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(`form-guard:${payload}`).digest("base64url").slice(0, 32);
}

export function issueFormToken(now = Date.now()): string {
  const payload = `${now.toString(36)}.${randomBytes(6).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export type GuardVerdict = "ok" | "missing" | "forged" | "too_fast" | "expired" | "trap";

export function inspectFormGuard(guard: { token?: string | null | undefined; trap?: string | null | undefined } | null | undefined, now = Date.now()): GuardVerdict {
  if (guard?.trap) return "trap";
  const token = guard?.token;
  if (!token) return "missing";
  const cut = token.lastIndexOf(".");
  if (cut < 0) return "forged";
  const payload = token.slice(0, cut);
  const given = Buffer.from(token.slice(cut + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "forged";
  const issued = Number.parseInt(payload.split(".")[0] ?? "", 36);
  if (!Number.isFinite(issued)) return "forged";
  const age = now - issued;
  if (age < MIN_AGE_MS) return "too_fast";
  if (age > MAX_AGE_MS) return "expired";
  return "ok";
}

const blocked: { at: number; form: string; verdict: GuardVerdict }[] = [];

/** Blocked attempts of the last 24 hours, for the administrators' security view. */
export function blockedFormAttempts(now = Date.now()): { total: number; byForm: Record<string, number> } {
  const recent = blocked.filter((entry) => now - entry.at < 24 * 60 * 60_000);
  const byForm: Record<string, number> = {};
  for (const entry of recent) byForm[entry.form] = (byForm[entry.form] ?? 0) + 1;
  return { total: recent.length, byForm };
}

/** Throws a plain-words error when the form does not look sent by a person. */
export function assertHumanForm(form: string, guard: { token?: string | null | undefined; trap?: string | null | undefined } | null | undefined): void {
  const verdict = inspectFormGuard(guard);
  if (verdict === "ok") return;
  blocked.push({ at: Date.now(), form, verdict });
  if (blocked.length > 2_000) blocked.splice(0, blocked.length - 2_000);
  logger.warn("form guard blocked a submission", { form, verdict });
  if (verdict === "too_fast") throw new BadRequestError("That was very fast. Wait a few seconds, then send again.");
  if (verdict === "expired") throw new BadRequestError("This form stayed open too long. Reload the page, then send again.");
  throw new BadRequestError("We could not check this form. Reload the page, then send again.");
}
