import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { ParticipationPublisher } from "@/components/agent/participation-publisher";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Projets et votes" };

/** F65 + F67 — administrators publish city projects and open votes. */
export default async function ParticipationAdminPage() {
  return withAgentAccess(
    "/agent/participation",
    async () => {
      const { t } = await getServerDictionary();
      return (
        <div className="flex flex-col gap-4">
          <header className="flex flex-col gap-1 px-1">
            <h1 className="text-xl font-semibold tracking-tight">{t("tn.participate.admin.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tn.participate.admin.subtitle")}</p>
          </header>
          <ParticipationPublisher />
        </div>
      );
    },
    "admin",
  );
}
