import type { Locale } from "@/lib/i18n/config";

/**
 * Locale-aware date formatting.
 *
 * Rendering happens on the server, where the visitor's locale is known from the
 * cookie — so formatting there keeps dates consistent between the first paint and
 * any later client re-render. All helpers accept ISO strings because that is the
 * only shape dates travel in over the API.
 */

const DATE_STYLES = {
  short: { day: "numeric", month: "short" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
} as const;

const TIME_STYLE = { hour: "2-digit", minute: "2-digit" } as const;

function resolveLocale(locale: Locale | undefined): string {
  return locale === "en" ? "en-GB" : "fr-FR";
}

export function formatDate(
  iso: string,
  options: { locale?: Locale; style?: keyof typeof DATE_STYLES; withTime?: boolean } = {},
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const style = options.style ?? "medium";
  const parts = new Intl.DateTimeFormat(resolveLocale(options.locale), {
    ...DATE_STYLES[style],
    ...(options.withTime ? TIME_STYLE : {}),
  });

  return parts.format(date);
}

/** Full date and time, e.g. "12 sept. 2026, 14:32". */
export function formatDateTime(iso: string, locale?: Locale): string {
  return formatDate(iso, { locale, style: "medium", withTime: true });
}

/** Date only, long form — used on legal pages. */
export function formatLongDate(iso: string, locale?: Locale): string {
  return formatDate(iso, { locale, style: "long" });
}

/**
 * Relative time for activity feeds.
 *
 * `Intl.RelativeTimeFormat` with unit selection handles the "2 min ago" /
 * "il y a 2 min" formatting without a dependency; anything older than a week
 * falls back to the absolute date because relative labels stop being useful there.
 */
export function formatRelative(iso: string, locale?: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const now = Date.now();
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(resolveLocale(locale), { numeric: "auto" });

  const units: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.345],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ];

  let value = diffSeconds;
  for (const [unit, threshold] of units) {
    if (Math.abs(value) < threshold) return rtf.format(Math.round(value), unit);
    value /= threshold;
  }

  return formatDate(iso, { locale });
}
