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

  /**
   * Chat messages per user. A short burst window lets people fire off a few
   * quick lines (a one-per-second rule broke normal typing); the long window
   * still stops a flood or a bot.
   */
  chatMessage: { limit: 20, windowMs: 15_000 },
  chatMessageSustained: { limit: 150, windowMs: 5 * 60_000 },

  /** Reactions per user: generous for scrolling, fatal for a like-bot. */
  reaction: { limit: 60, windowMs: 60_000 },

  /** Comments per user. */
  comment: { limit: 10, windowMs: 60_000 },

  /** Follow/unfollow toggles per user. */
  follow: { limit: 30, windowMs: 60_000 },

  /** New conversations and group membership changes per user. */
  conversation: { limit: 20, windowMs: 60 * 60_000 },

  /** User directory searches per user. */
  userSearch: { limit: 60, windowMs: 60_000 },

  /** Posts published per user. */
  postCreate: { limit: 20, windowMs: 10 * 60_000 },

  /** Password change attempts per signed-in account. */
  passwordChange: { limit: 5, windowMs: 15 * 60_000 },

  /** Conversations opened or created per user. */
  openConversation: { limit: 120, windowMs: 10 * 60_000 },

  /** Geocoding lookups per user (upstream allows ~1/s for the whole app). */
  places: { limit: 30, windowMs: 60_000 },

  /** Call attempts per user. */
  call: { limit: 20, windowMs: 10 * 60_000 },

  /** Groups created per user. */
  groupCreate: { limit: 5, windowMs: 60 * 60_000 },
  pageCreate: { limit: 10, windowMs: 60 * 60_000 },
  /** Full data exports are heavy: a few per hour. */
  dataExport: { limit: 3, windowMs: 60 * 60_000 },
  /** Requests to the city per citizen. */
  cityRequestCreate: { limit: 10, windowMs: 60 * 60_000 },
  pageUpdate: { limit: 120, windowMs: 10 * 60_000 },
  /** One counted view per visitor and page every 6 hours. */
  pageView: { limit: 1, windowMs: 6 * 60 * 60_000 },

  /** Username availability probes per IP (public, typed live in a form). */
  usernameCheck: { limit: 60, windowMs: 60_000 },

  /** AI tool-assisted answers per user. */
  aiTools: { limit: 20, windowMs: 60_000 },

  /** Message edits and deletions per user. */
  messageEdit: { limit: 30, windowMs: 60_000 },

  /** Content reports per user. */
  report: { limit: 10, windowMs: 60 * 60_000 },

  /** Public endpoint protection (health, auth catch-all). */
  public: { limit: 60, windowMs: 60_000 },

  /** Default for authenticated JSON APIs. */
  api: { limit: 240, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;
