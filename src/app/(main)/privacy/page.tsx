import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { getLegalDocument } from "@/content/legal";
import { getLocale, getServerDictionary } from "@/lib/i18n/server";

/**
 * Public, whitelisted in `src/proxy.ts`, and linked from the footer, the left
 * rail and the registration form — all three of which assumed it existed.
 *
 * Metadata is static because the title lives in the document, which is loaded
 * per-locale. The template in the root layout still gives it the product name.
 */
export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Quelles données cette application collecte, pourquoi, qui d'autre y accède, et vos droits.",
  robots: { index: true, follow: true },
  // The deployment answers on four subdomains, two of which 403 or 404. Naming
  // one origin stops that being read as four copies of the same document.
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const [locale, { t }] = await Promise.all([getLocale(), getServerDictionary()]);

  return <LegalPage document={getLegalDocument("privacy", locale)} t={t} />;
}