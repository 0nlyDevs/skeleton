import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { RequestView } from "@/components/city/request-view";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { NotFoundError } from "@/lib/errors";
import { getCityRequest } from "@/modules/city-requests/city-requests.service";
import { cityRequestRefParamSchema } from "@/modules/city-requests/city-requests.schema";

export const metadata: Metadata = { title: "Demande" };

/** F22 — an agent handles one request: answer, internal note, status, priority. */
export default async function AgentRequestPage({ params }: { readonly params: Promise<{ reference: string }> }) {
  const raw = await params;
  return withAgentAccess(`/agent/demandes/${encodeURIComponent(raw.reference)}`, async (user) => {
    const parsed = cityRequestRefParamSchema.safeParse(raw);
    const request = parsed.success
      ? await getCityRequest(parsed.data.reference, user).catch((error: unknown) => {
          if (error instanceof NotFoundError) return null;
          throw error;
        })
      : null;
    if (!request) return <NotFoundPanel backHref="/agent/demandes" />;
    return <RequestView initial={request} mode="agent" viewerId={user.id} />;
  });
}
