import type { Metadata } from "next";

import { AnnouncementEditor } from "@/components/agent/announcement-editor";
import { withAgentAccess } from "@/components/agent/agent-guard";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Nouvelle annonce" };

export default async function NewAnnouncementPage() {
  return withAgentAccess("/agent/annonces/nouvelle", async (user) => {
    const services = await listServices({}, user);
    return <AnnouncementEditor initial={null} services={services.map(({ id, name, slug }) => ({ id, name, slug }))} />;
  });
}
