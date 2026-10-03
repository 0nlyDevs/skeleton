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

/**
 * Reads the locale out of a raw `Cookie` header.
 *
 * The cookie is written on the client by the i18n provider, so the two places
 * that need the locale outside a server render read the header themselves:
 *
 *   * the socket handshake, where only `handshake.headers` exists;
 *   * the BetterAuth callbacks that send transactional mail, which run outside
 *     any Next.js request scope where `cookies()` would throw.
 */
export function localeFromCookieHeader(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`).exec(header);
  const value = match?.[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
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
