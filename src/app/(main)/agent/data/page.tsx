import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { DataSafetyPanel } from "@/components/agent/data-safety-panel";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Données : cohérence et sauvegarde" };

/** F85 + F87 — administrators check that the data is coherent and can be saved. */
export default async function DataSafetyPage() {
  return withAgentAccess(
    "/agent/data",
    async () => {
      const { t } = await getServerDictionary();
      return (
        <div className="flex flex-col gap-4">
          <header className="flex flex-col gap-1 px-1">
            <h1 className="text-xl font-semibold tracking-tight">{t("tn.data.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tn.data.subtitle")}</p>
          </header>
          <DataSafetyPanel />
        </div>
      );
    },
    "admin",
  );
}
