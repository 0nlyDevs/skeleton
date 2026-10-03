import type { Metadata } from "next";

import { RequestView } from "@/components/city/request-view";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { NotFoundError } from "@/lib/errors";
import { getCityRequest } from "@/modules/city-requests/city-requests.service";
import { cityRequestRefParamSchema } from "@/modules/city-requests/city-requests.schema";

export const metadata: Metadata = { title: "Ma demande" };

/** D03/D04 — one of the citizen's own requests; anyone else's reads as not found. */
export default async function CitizenRequestPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ reference: string }>;
  readonly searchParams: Promise<{ envoyee?: string }>;
}) {
  const raw = await params;
  const { user } = await requirePageAuth(`/espace/demandes/${encodeURIComponent(raw.reference)}`);
  const parsed = cityRequestRefParamSchema.safeParse(raw);
  const request = parsed.success
    ? await getCityRequest(parsed.data.reference, user).catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      })
    : null;
  // The citizen space only shows the viewer's own requests, even to agents.
  if (!request || (request.citizen !== null && request.citizen.id !== user.id)) return <NotFoundPanel backHref="/espace" />;

  const { envoyee } = await searchParams;
  return <RequestView initial={request} mode="citizen" viewerId={user.id} justSent={envoyee === "1"} />;
}
