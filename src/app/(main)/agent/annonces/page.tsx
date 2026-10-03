import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { AnnouncementCard } from "@/components/city/announcement-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAnnouncements } from "@/modules/announcements/announcements.service";

export const metadata: Metadata = { title: "Annonces — espace agent" };

/** Agents manage the city's announcements, drafts included. */
export default async function AgentAnnouncementsPage() {
  return withAgentAccess("/agent/annonces", async (user) => {
    const { t } = await getServerDictionary();
    const result = await listAnnouncements({ drafts: "1", page: 1, limit: 50 }, user);
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">{t("tn.agent.news.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tn.agent.news.subtitle")}</p>
          </div>
          <Button asChild>
            <Link href="/agent/annonces/nouvelle">
              <Plus aria-hidden />
              {t("tn.agent.news.new")}
            </Link>
          </Button>
        </header>
        {result.data.length === 0 ? (
          <EmptyState title={t("tn.agent.news.empty")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {result.data.map((announcement) => (
              <li key={announcement.id}>
                <AnnouncementCard announcement={announcement} href={`/agent/annonces/${announcement.slug}`} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  });
}
