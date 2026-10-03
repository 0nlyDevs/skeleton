import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { EntityHistory } from "@/components/agent/activity-history";
import { ServiceEditor } from "@/components/agent/service-editor";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { NotFoundError } from "@/lib/errors";
import { getService } from "@/modules/city-services/city-services.service";
import { serviceSlugParamSchema } from "@/modules/city-services/city-services.schema";

export const metadata: Metadata = { title: "Modifier le service" };

export default async function EditServicePage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const raw = await params;
  return withAgentAccess(
    `/agent/services/${encodeURIComponent(raw.slug)}`,
    async (user) => {
      const parsed = serviceSlugParamSchema.safeParse(raw);
      const service = parsed.success
        ? await getService(parsed.data.slug, user).catch((error: unknown) => {
            if (error instanceof NotFoundError) return null;
            throw error;
          })
        : null;
      if (!service) return <NotFoundPanel backHref="/agent/services" />;
      return (
        <div className="flex flex-col gap-6">
          <ServiceEditor initial={service} />
          <EntityHistory targetType="service" targetId={service.id} />
        </div>
      );
    },
    "admin",
  );
}
