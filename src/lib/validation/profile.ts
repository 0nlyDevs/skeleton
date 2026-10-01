/**
 * Identity field rules: username, first/last name, birth date.
 *
 * Pure (Zod only) on purpose: the sign-up hook, the profile API and both forms
 * import the same schemas, so a rule cannot be stricter in the browser than on
 * the server, or the other way round.
 */

import { z } from "zod";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PERSON_NAME_MAX_LENGTH = 50;
export const MIN_AGE_YEARS = 13;
export const MAX_AGE_YEARS = 120;

/**
 * Handles that would impersonate the platform or collide with routes.
 * Compared after normalisation (lowercase, separators removed).
 */
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "moderator",
  "staff",
  "webcup",
  "official",
  "security",
  "api",
  "me",
  "settings",
  "null",
  "undefined",
]);

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Why a username is unacceptable, or `null`. Used by BetterAuth's validator too. */
export function usernameViolation(raw: string): string | null {
  const value = normalizeUsername(raw);
  if (value.length < USERNAME_MIN_LENGTH) return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  if (value.length > USERNAME_MAX_LENGTH) return `Use at most ${USERNAME_MAX_LENGTH} characters.`;
  if (!USERNAME_PATTERN.test(value)) {
    return "Use letters, digits, dots and underscores, starting and ending with a letter or digit.";
  }
  if (/[_.]{2}/.test(value)) return "Do not chain dots or underscores.";
  if (RESERVED_USERNAMES.has(value.replace(/[_.]/g, ""))) return "This username is reserved.";
  return null;
}

export const usernameSchema = z
  .string()
  .max(USERNAME_MAX_LENGTH * 2)
  .transform(normalizeUsername)
  .superRefine((value, context) => {
    const violation = usernameViolation(value);
    if (violation) context.addIssue({ code: "custom", message: violation });
  });

/** Letters (any script), spaces, apostrophes and hyphens: "Jean-Luc", "O'Brien". */
const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;

export function personNameViolation(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length === 0) return "This field is required.";
  if (value.length > PERSON_NAME_MAX_LENGTH) return `Use at most ${PERSON_NAME_MAX_LENGTH} characters.`;
  if (!PERSON_NAME_PATTERN.test(value)) return "Use letters, spaces, apostrophes or hyphens only.";
  return null;
}

export const personNameSchema = z
  .string()
  .max(PERSON_NAME_MAX_LENGTH * 2)
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .superRefine((value, context) => {
    const violation = personNameViolation(value);
    if (violation) context.addIssue({ code: "custom", message: violation });
  });

/** Display name derived from the two name parts, never typed separately. */
export function composeDisplayName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

function ageOn(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Parse a `YYYY-MM-DD` calendar date as UTC midnight, rejecting `2026-02-31`. */
export function parseBirthDate(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const roundTrips =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);

  return roundTrips ? date : null;
}

export function birthDateViolation(raw: string, today = new Date()): string | null {
  const date = parseBirthDate(raw);
  if (!date) return "Enter a valid date.";
  if (date.getTime() > today.getTime()) return "The birth date cannot be in the future.";

  const age = ageOn(date, today);
  if (age < MIN_AGE_YEARS) return `You must be at least ${MIN_AGE_YEARS} years old.`;
  if (age > MAX_AGE_YEARS) return "Enter a realistic birth date.";
  return null;
}

/** `YYYY-MM-DD` in, `Date` (UTC midnight) out. */
export const birthDateSchema = z
  .string()
  .max(20)
  .superRefine((value, context) => {
    const violation = birthDateViolation(value);
    if (violation) context.addIssue({ code: "custom", message: violation });
  })
  .transform((value) => parseBirthDate(value) as Date);

/** `Date` back to the `YYYY-MM-DD` the date input expects. */
export function formatBirthDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
