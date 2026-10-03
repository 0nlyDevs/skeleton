import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { WebcupFeedView } from "@/components/agent/webcup-feed-view";
import { getWebcupFeed } from "@/modules/webcup/webcup.service";

export const metadata: Metadata = { title: "Flux Nova Terra" };

export default async function AgentFeedPage() {
  return withAgentAccess("/agent/feed", async (user) => <WebcupFeedView initial={await getWebcupFeed(user)} />);
}
