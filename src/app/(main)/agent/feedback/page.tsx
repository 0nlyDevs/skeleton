import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { FeedbackInbox } from "@/components/agent/feedback-inbox";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Avis des habitants" };

/** F76 — agents read residents' comments, confirm they were read and answer. */
export default async function AgentFeedbackPage() {
  return withAgentAccess("/agent/feedback", async (user) => {
    const { t, locale } = await getServerDictionary();
    const services = await listServices({}, user, locale);
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.feedback.agent.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.feedback.agent.subtitle")}</p>
        </header>
        <FeedbackInbox services={services.map(({ slug, name }) => ({ slug, name }))} />
      </div>
    );
  });
}
