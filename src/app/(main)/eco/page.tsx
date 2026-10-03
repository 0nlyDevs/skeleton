import { Gauge, ImageDown, Leaf, MousePointerClick, Shapes, Type, Wifi } from "lucide-react";
import type { Metadata } from "next";

import { LightModeSwitch } from "@/components/eco/light-mode-switch";
import { EcoReportTable } from "@/components/eco/eco-report-table";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import report from "@/data/eco-report.json";
import { getServerDictionary } from "@/lib/i18n/server";
import type { EcoReport } from "@/components/eco/eco-report-table";

export const metadata: Metadata = { title: "Sobriété numérique" };

/**
 * Environmental footprint of the platform, measured (EcoIndex, by
 * `scripts/eco-audit.mjs`) rather than claimed, with the choices that brought
 * it down and the light mode residents on a slow connection get by default.
 */
export default async function EcoPage() {
  const { t, locale } = await getServerDictionary();
  const choices = [
    { id: "light", icon: Wifi, title: t("tn.eco.choice.light.title"), body: t("tn.eco.choice.light.body") },
    { id: "models", icon: Shapes, title: t("tn.eco.choice.models.title"), body: t("tn.eco.choice.models.body") },
    { id: "images", icon: ImageDown, title: t("tn.eco.choice.images.title"), body: t("tn.eco.choice.images.body") },
    { id: "fonts", icon: Type, title: t("tn.eco.choice.fonts.title"), body: t("tn.eco.choice.fonts.body") },
    { id: "loading", icon: MousePointerClick, title: t("tn.eco.choice.loading.title"), body: t("tn.eco.choice.loading.body") },
  ];
  const data = report as EcoReport;
  const measuredAt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "long" }).format(new Date(data.measuredAt));

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.eco.title") }]} />
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.eco.title")}</h1>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{t("tn.eco.intro")}</p>
      </header>

      <section aria-labelledby="eco-light" className="flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/5 p-5">
        <h2 id="eco-light" className="flex items-center gap-2 font-semibold">
          <Leaf className="size-5 text-success" aria-hidden />
          {t("tn.eco.light.title")}
        </h2>
        <p className="text-[0.9375rem] leading-relaxed">{t("tn.eco.light.body")}</p>
        <LightModeSwitch />
      </section>

      <section aria-labelledby="eco-measure" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
        <h2 id="eco-measure" className="flex items-center gap-2 font-semibold">
          <Gauge className="size-5 text-primary" aria-hidden />
          {t("tn.eco.measure.title")}
        </h2>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{t("tn.eco.measure.body", { date: measuredAt })}</p>
        <EcoReportTable report={data} />
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{t("tn.eco.measure.method")}</p>
      </section>

      <section aria-labelledby="eco-choices" className="flex flex-col gap-3">
        <h2 id="eco-choices" className="px-1 font-semibold">{t("tn.eco.choices.title")}</h2>
        {choices.map((choice) => (
          <div key={choice.id} className="flex gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
            <choice.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h3 className="font-semibold">{choice.title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{choice.body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
