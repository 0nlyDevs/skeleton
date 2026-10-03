import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { TransportLinesManager } from "@/components/agent/transport-lines-manager";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Transports — administration" };

export default async function AgentTransportsPage() {
  return withAgentAccess("/agent/transports", async () => {
    const { t } = await getServerDictionary();
    return <div className="flex flex-col gap-5"><header className="flex flex-col gap-1 px-1"><h1 className="text-xl font-semibold tracking-tight">{t("tn.agent.transports.title")}</h1><p className="text-sm text-muted-foreground">{t("tn.agent.transports.subtitle")}</p></header><TransportLinesManager /></div>;
  }, "staff");
}
