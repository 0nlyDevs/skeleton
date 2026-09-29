import type { RateLimitRule } from "./types";

/**
 * Every limit in the application, in one place, with the reasoning attached.
 * Tuning a limit is a one-line change here and nowhere else.
 *
 * The window is a fixed window (see `MemoryRateLimitStore`), so a client can
 * burst up to `2 × limit` across a window boundary. For sign-in that is
 * immaterial: the goal is to make credential stuffing and brute force
 * impractical, not to shape traffic to the millisecond.
 */
export const RATE_LIMITS = {
  /** Failed sign-in attempts, counted per IP **and** per account. */
  login: { limit: 5, windowMs: 15 * 60_000 },

  /** Account creations per IP. Generous enough for a shared office network. */
  register: { limit: 5, windowMs: 60 * 60_000 },

  /** Password-reset requests per account. */
  passwordReset: { limit: 3, windowMs: 60 * 60_000 },

  /** Verification-email resends per account. */
  emailVerification: { limit: 3, windowMs: 15 * 60_000 },

  /** Two-factor challenge attempts per session/IP. */
  twoFactor: { limit: 10, windowMs: 15 * 60_000 },

  /** AI completions per user. */
  ai: { limit: 10, windowMs: 60_000 },

  /** Uploads per user. */
  upload: { limit: 10, windowMs: 60_000 },

  /** Chat messages per user: one per second. */
  chatMessage: { limit: 1, windowMs: 1_000 },

  /** Content reports per user. */
  report: { limit: 10, windowMs: 60 * 60_000 },

  /** Public endpoint protection (health, auth catch-all). */
  public: { limit: 60, windowMs: 60_000 },

  /** Default for authenticated JSON APIs. */
  api: { limit: 240, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;
