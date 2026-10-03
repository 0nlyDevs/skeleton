import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { OfficialMessageComposer } from "@/components/agent/official-message-composer";
import { getServerDictionary } from "@/lib/i18n/server";
import { listOfficialMessages } from "@/modules/official-messages/official-messages.service";

export const metadata: Metadata = { title: "Message officiel" };

/** F73 — the High Council publishes a message that reaches every screen at once. */
export default async function OfficialMessagePage() {
  return withAgentAccess(
    "/agent/official",
    async (user) => {
      const { t } = await getServerDictionary();
      const history = await listOfficialMessages(user);
      return (
        <div className="flex flex-col gap-4">
          <header className="flex flex-col gap-1 px-1">
            <h1 className="text-xl font-semibold tracking-tight">{t("tn.official.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tn.official.page.subtitle")}</p>
          </header>
          <OfficialMessageComposer history={history} />
        </div>
      );
    },
    "admin",
  );
}
