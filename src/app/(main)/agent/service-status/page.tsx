import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { ServiceStatusBoard } from "@/components/agent/service-status-board";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "État des services" };

/** F38 — agents and admins report and close service interruptions here. */
export default async function ServiceStatusPage() {
  return withAgentAccess("/agent/service-status", async (user) => {
    const { t, locale } = await getServerDictionary();
    const services = await listServices({}, user, locale);
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.availability.board.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.availability.board.subtitle")}</p>
        </header>
        <ServiceStatusBoard services={services.map(({ slug, name, availability }) => ({ slug, name, availability }))} />
      </div>
    );
  });
}
