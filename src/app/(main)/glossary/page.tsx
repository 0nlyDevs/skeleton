import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { GLOSSARY_IDS } from "@/lib/glossary";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Lexique" };

/** D13 — every word the platform explains, in plain language, in alphabetical order. */
export default async function GlossaryPage() {
  const { t, locale } = await getServerDictionary();
  const entries = GLOSSARY_IDS.map((id) => ({
    id,
    term: t(`tn.glossary.term.${id}` as MessageKey),
    definition: t(`tn.glossary.def.${id}` as MessageKey),
  })).sort((a, b) => a.term.localeCompare(b.term, locale));

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.glossary.title") }]} />
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.glossary.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.glossary.subtitle")}</p>
      </header>

      <nav aria-label={t("tn.glossary.index")} className="flex flex-wrap gap-1.5 px-1">
        {entries.map((entry) => (
          <a key={entry.id} href={`#${entry.id}`} className="rounded-full border border-border bg-card px-3 py-1 text-[0.8125rem] hover:bg-surface-muted">
            {entry.term}
          </a>
        ))}
      </nav>

      <dl className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel">
        {entries.map((entry) => (
          <div key={entry.id} id={entry.id} className="scroll-mt-24 px-5 py-4">
            <dt className="font-semibold">{entry.term}</dt>
            <dd className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{entry.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
