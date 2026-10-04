import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { PartnerProposalsPanel } from "@/components/agent/partner-proposals-panel";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Propositions des partenaires" };

/** F99 — partner proposals waiting for the city's answer. */
export default async function AgentPartnersPage() {
  return withAgentAccess("/agent/partners", async () => {
    const { t } = await getServerDictionary();
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.partners.admin.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.partners.admin.subtitle")}</p>
        </header>
        <PartnerProposalsPanel />
      </div>
    );
  });
}
