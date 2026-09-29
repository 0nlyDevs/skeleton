/**
 * Server-side locale resolution.
 *
 * Reads the preference cookie, falling back to the browser's Accept-Language
 * header and finally to French. Resolving on the server means the first paint is
 * already in the right language — no flash of untranslated content, which is the
 * usual cost of a client-only i18n setup.
 */

import { cookies, headers } from "next/headers";

import {
  createTranslator,
  DEFAULT_LOCALE,
  getDictionary,
  isLocale,
  localeFromAcceptLanguage,
  type Dictionary,
  type Translator,
} from "./index";
import { LOCALE_COOKIE, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const headerList = await headers();
  return localeFromAcceptLanguage(headerList.get("accept-language"));
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
