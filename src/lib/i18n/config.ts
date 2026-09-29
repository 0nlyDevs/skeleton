/**
 * Localization configuration.
 *
 * The app is French-first because the jury is francophone, with English one click
 * away. The choice lives in a cookie rather than the URL for three reasons:
 *
 *   * it keeps every route a single canonical path (`/dashboard`, not
 *     `/fr/dashboard`), so links, emails and the API stay locale-free;
 *   * the toggle is instant, with no route rewrite and no middleware negotiation;
 *   * a shared link always opens in the recipient's own language.
 *
 * The trade-off is that a page cannot be SEO-indexed per language. This is an
 * authenticated application, so that costs nothing.
 */

export const LOCALES = ["fr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "webcup_locale";

/** One year: the choice should outlive the contest. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

/** Short code shown on the toggle button. */
export const LOCALE_SHORT: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
};
