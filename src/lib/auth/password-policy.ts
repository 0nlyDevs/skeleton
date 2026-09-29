/**
 * Password policy.
 *
 * Follows current NIST guidance: length and a blocklist, not forced character
 * classes. Composition rules push people towards `Password1!`, while a length
 * floor plus a check against the passwords that actually appear in breach
 * corpora is measurably stronger.
 *
 * The strength estimate is a display aid for the sign-up form. It must never be
 * the thing that decides whether an account can be created — `passwordSchema`
 * is.
 */

import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * A short list of the passwords that dominate credential-stuffing dictionaries.
 * Not exhaustive by design: a full corpus belongs in a bloom filter or an API
 * call, and an 8-character minimum already removes the trivial cases.
 */
const BLOCKED_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "azerty123",
  "iloveyou",
  "admin123",
  "administrator",
  "letmein123",
  "welcome123",
  "changeme",
  "motdepasse",
  "soleil123",
  "webcup123",
]);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`)
  .refine((value) => value.trim().length > 0, "The password cannot be only spaces.")
  .refine(
    (value) => !BLOCKED_PASSWORDS.has(value.toLowerCase()),
    "This password is too common. Choose something less predictable.",
  );

export type PasswordStrength = {
  /** 0 (very weak) to 4 (very strong). */
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly label: string;
};

/** Rough entropy estimate in bits, plus penalties for repetition. */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { score: 0, label: "empty" };

  let alphabet = 0;
  if (/[a-z]/.test(password)) alphabet += 26;
  if (/[A-Z]/.test(password)) alphabet += 26;
  if (/\d/.test(password)) alphabet += 10;
  if (/[^A-Za-z0-9]/.test(password)) alphabet += 33;
  if (alphabet === 0) alphabet = 10;

  // Unique-character ratio defeats `aaaaaaaaaaaaaaaa`.
  const uniqueRatio = new Set(password).size / password.length;
  const entropyBits = password.length * Math.log2(alphabet) * (0.5 + uniqueRatio / 2);

  if (BLOCKED_PASSWORDS.has(password.toLowerCase())) return { score: 0, label: "too common" };

  if (entropyBits < 28) return { score: 0, label: "very weak" };
  if (entropyBits < 40) return { score: 1, label: "weak" };
  if (entropyBits < 60) return { score: 2, label: "fair" };
  if (entropyBits < 80) return { score: 3, label: "strong" };
  return { score: 4, label: "very strong" };
}
