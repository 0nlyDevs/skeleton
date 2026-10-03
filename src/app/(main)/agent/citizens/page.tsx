import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { CitizensManager } from "@/components/agent/citizens-manager";

export const metadata: Metadata = { title: "Comptes des habitants" };

/** F34 — agents administer resident accounts (staff accounts and roles stay with admins). */
export default async function AgentCitizensPage() {
  return withAgentAccess("/agent/citizens", () => <CitizensManager />);
}
