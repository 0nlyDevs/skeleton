import type { Metadata } from "next";

import { AnnouncementEditor } from "@/components/agent/announcement-editor";
import { withAgentAccess } from "@/components/agent/agent-guard";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { NotFoundError } from "@/lib/errors";
import { getAnnouncement } from "@/modules/announcements/announcements.service";
import { announcementSlugParamSchema } from "@/modules/announcements/announcements.schema";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Modifier l'annonce" };

export default async function EditAnnouncementPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const raw = await params;
  return withAgentAccess(`/agent/annonces/${encodeURIComponent(raw.slug)}`, async (user) => {
    const parsed = announcementSlugParamSchema.safeParse(raw);
    const [announcement, services] = await Promise.all([
      parsed.success
        ? getAnnouncement(parsed.data.slug, user).catch((error: unknown) => {
            if (error instanceof NotFoundError) return null;
            throw error;
          })
        : null,
      listServices({}, user),
    ]);
    if (!announcement) return <NotFoundPanel backHref="/agent/annonces" />;
    return <AnnouncementEditor initial={announcement} services={services.map(({ id, name, slug }) => ({ id, name, slug }))} />;
  });
}
