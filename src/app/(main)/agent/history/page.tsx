import type { Metadata } from "next";

import { ActivityHistory } from "@/components/agent/activity-history";
import { withAgentAccess } from "@/components/agent/agent-guard";

export const metadata: Metadata = { title: "Historique des actions" };

/** D21 — who did what in the administration, for every agent. */
export default async function AgentHistoryPage() {
  return withAgentAccess("/agent/history", () => <ActivityHistory />);
}
