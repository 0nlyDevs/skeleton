import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { getLegalDocument } from "@/content/legal";
import { getLocale, getServerDictionary } from "@/lib/i18n/server";

/** See `../privacy/page.tsx` — the same shape, the other document. */
export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Ce que vous pouvez attendre de ce service, et ce qui est attendu de vous.",
  robots: { index: true, follow: true },
  // See `../privacy/page.tsx`: four subdomains answer for one deployment.
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const [locale, { t }] = await Promise.all([getLocale(), getServerDictionary()]);

  return <LegalPage document={getLegalDocument("terms", locale)} t={t} />;
}