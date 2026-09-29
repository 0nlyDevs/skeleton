/**
 * Translation helper — shared by server and client.
 *
 * `{name}` placeholders are replaced with `params`. Unknown placeholders are
 * left intact rather than replaced with `undefined`, which makes a missing
 * parameter visible in the UI instead of silently rendering "undefined" — a
 * detail that matters when a formatter writes copy at 3am.
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { fr, type Dictionary, type MessageKey } from "./dictionaries/fr";

export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE } from "./config";
export type { Locale } from "./config";
export type { Dictionary, MessageKey } from "./dictionaries/fr";

export const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type TranslationParams = Record<string, string | number>;

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** A translator bound to one dictionary. */
export type Translator = (key: MessageKey, params?: TranslationParams) => string;

export function createTranslator(locale: Locale): Translator {
  const dictionary = getDictionary(locale);
  return (key, params) => interpolate(dictionary[key] ?? key, params);
}

/**
 * Resolve a locale from an Accept-Language header, used as a fallback before the
 * cookie has been set.
 */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const preferred = header
    .split(",")
    .map((entry) => {
      const [tag, quality] = entry.trim().split(";q=");
      return { tag: (tag ?? "").trim().toLowerCase(), quality: Number(quality ?? "1") };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of preferred) {
    const base = entry.tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

export { isLocale };
