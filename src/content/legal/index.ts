/**
 * Legal document registry.
 *
 * `/privacy` and `/terms` are linked from the footer, the left rail and the
 * registration form, and whitelisted as public in `src/proxy.ts` — all of which
 * assumed these pages existed. They 404ed.
 *
 * The content lives in `./en.ts` and `./fr.ts`, translated by hand rather than
 * through the interface dictionary, because a policy that names its
 * sub-processors is prose with headings and a table — not a set of UI labels.
 */

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

import en from "./en";
import fr from "./fr";
import type { LegalDocument } from "./types";

const bundles: Record<Locale, { documents: Record<LegalDocument["slug"], LegalDocument> }> = {
  fr,
  en,
};

/** Every locale carries both documents; the default is the fallback. */
export function getLegalDocument(slug: LegalDocument["slug"], locale: Locale): LegalDocument {
  const bundle = bundles[locale] ?? bundles[DEFAULT_LOCALE];
  return bundle.documents[slug];
}

export { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n";
export type { LegalDocument, LegalSection } from "./types";
