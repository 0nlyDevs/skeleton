import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { ExportBuilder } from "@/components/agent/export-builder";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Exporter des données de suivi" };

/** F88 — staff choose follow-up data and download it in a reusable format. */
export default async function ExportsPage() {
  return withAgentAccess("/agent/exports", async () => {
    const { t } = await getServerDictionary();
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.export.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.export.subtitle")}</p>
        </header>
        <ExportBuilder />
      </div>
    );
  });
}
