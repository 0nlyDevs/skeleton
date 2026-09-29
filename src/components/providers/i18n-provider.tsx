"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import {
  interpolate,
  type Dictionary,
  type Locale,
  type MessageKey,
  type TranslationParams,
} from "@/lib/i18n";

interface I18nContextValue {
  readonly locale: Locale;
  readonly t: (key: MessageKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Seeds the client with the dictionary the server already resolved, so the first
 * client render matches the server HTML exactly (no hydration mismatch, no
 * untranslated flash).
 */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => interpolate(dictionary[key] ?? key, params),
    }),
    [locale, dictionary],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside an I18nProvider.");
  }
  return context;
}

/** Convenience hook for components that only need the translate function. */
export function useTranslation(): (key: MessageKey, params?: TranslationParams) => string {
  return useI18n().t;
}

/**
 * Persist a language choice and refresh. A full reload is correct here: every
 * server component reads the cookie, so the whole tree must be re-rendered
 * rather than partially patched.
 */
export function useLocaleSwitch(): (next: Locale) => void {
  return useCallback((next: Locale) => {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `webcup_locale=${next}; path=/; max-age=${maxAge}; samesite=lax`;
    window.location.reload();
  }, []);
}
