/**
 * Server-side locale resolution.
 *
 * Reads the preference cookie and falls back to French, the product
 * language (the browser's Accept-Language is deliberately ignored). Resolving on the server means the first paint is
 * already in the right language — no flash of untranslated content, which is the
 * usual cost of a client-only i18n setup.
 */

import { cookies } from "next/headers";

import {
  createTranslator,
  DEFAULT_LOCALE,
  getDictionary,
  isLocale,
  type Dictionary,
  type Translator,
} from "./index";
import { LOCALE_COOKIE, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  // French is the product language: an English browser still lands in French
  // and switches with one click (the choice is then kept in the cookie).
  return DEFAULT_LOCALE;
}

export async function getServerDictionary(): Promise<{
  locale: Locale;
  dictionary: Dictionary;
  t: Translator;
}> {
  const locale = await getLocale();
  return {
    locale,
    dictionary: getDictionary(locale),
    t: createTranslator(locale),
  };
}

/** Re-exported so a server component can resolve locale and copy in one import. */
export { DEFAULT_LOCALE, getDictionary };
