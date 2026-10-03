import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { AgentInbox } from "@/components/agent/agent-inbox";

export const metadata: Metadata = { title: "Demandes des habitants" };

export default async function AgentRequestsPage({ searchParams }: { readonly searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return withAgentAccess("/agent/requests", () => <AgentInbox initialStatus={status ?? "OPEN"} />);
}
