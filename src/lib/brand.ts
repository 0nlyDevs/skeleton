/**
 * Brand identity — the strings that name the product.
 *
 * The point of this file is that a rename should be one edit, not a hunt. At
 * H-0 the subject lands and the product gets a name; the cheaper that is, the
 * more of the remaining time goes into the product.
 *
 * ── Do not "tidy up" the frozen identifiers below ──────────────────────────
 *
 * Several strings that look like the brand name are load-bearing, and changing
 * them destroys data rather than renaming anything:
 *
 *   • `ENCRYPTION_KEY_INFO` is HKDF *key-derivation input*. Change it and every
 *     value written under the old label becomes undecryptable — silently, since
 *     a failed read used to look like an empty field.
 *   • `DEVICE_COOKIE` is a cookie name. Change it and every signed-in device
 *     loses its two-factor enrolment, because the server looks the device up by
 *     this name.
 *
 * They are listed here precisely so the next rename skips them. A repository-wide
 * find-and-replace would break both, and nothing would say so until messages
 * came back empty.
 *
 * Translations keep the brand as a literal: a dictionary is the right place for
 * a proper noun, and `tests/brand.test.ts` allows both dictionaries.
 */

export const brand = {
  /** Display name. Appears in the wordmark, page titles and the AI assistant. */
  name: "Skeleton",

  /** One line describing what the product is, for metadata and social cards. */
  description:
    "Skeleton — a social network to share posts, talk in real time and gather in groups.",

  /** Sent to the AI provider as the calling application, for their dashboards. */
  providerTitle: "Webcup Base",

  /** `User-Agent` for outbound requests this app initiates. */
  userAgent: "Skeleton/1.0",
} as const;

/**
 * Identifiers that must survive a rename. Documented, not configurable: making
 * them configurable would invite the change that breaks them.
 */
export const FROZEN_IDENTIFIERS = {
  /**
   * HKDF info string for field encryption. Part of the key derivation, so it is
   * as load-bearing as the key itself.
   */
  ENCRYPTION_KEY_INFO: "skeleton-data-encryption",
  /** Cookie holding the remembered two-factor device. Renaming logs devices out. */
  DEVICE_COOKIE: "skeleton_device",
} as const;

/** `${brand.name}/1.0` — the form Nominatim asks for in its User-Agent. */
export const APP_USER_AGENT = `${brand.userAgent} (${brand.name})`;