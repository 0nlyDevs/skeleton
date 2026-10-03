import type { Metadata } from "next";

import { CinematicLanding, type LandingData } from "@/components/cinematic/cinematic-landing";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { getZoneStatuses } from "@/modules/alerts/alerts.service";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { cityRequestStats, countHandledCityRequests } from "@/modules/city-requests/city-requests.service";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: { absolute: "Terra Nova — portail des habitants" } };

/**
 * D07 — the front door. An arrival from orbit (with the sign-in at the gate),
 * then a flight over the island where each district presents one part of the
 * portal: what you can do, the city's services, how to write to city hall, the
 * latest announcements, live figures, the agents' workspace, the state of the
 * districts. Every figure and card is real data, rendered on the server; the
 * animation only stages it.
 */
export default async function LandingPage() {
  const context = await getAuthContext();
  const user = context?.user ?? null;
  const { locale } = await getServerDictionary();
  const [services, news, handled, mine, zones] = await Promise.all([
    listServices({}, user, locale),
    listAnnouncements({ page: 1, limit: 3 }, user),
    countHandledCityRequests(),
    user ? cityRequestStats(user, "mine") : Promise.resolve(null),
    getZoneStatuses(),
  ]);

  const data: LandingData = {
    viewer: user
      ? {
          firstName: user.name.split(" ")[0] ?? user.name,
          staff: isStaff(user),
          openRequests: mine ? (mine.NEW ?? 0) + (mine.IN_PROGRESS ?? 0) + (mine.WAITING_CITIZEN ?? 0) : 0,
        }
      : null,
    services: services.slice(0, 6).map(({ slug, name, summary, icon, category, featured }) => ({ slug, name, summary, icon, category, featured })),
    news: news.data.map(({ slug, title, summary, category, publishedAt }) => ({ slug, title, summary, category, publishedAt })),
    stats: { services: services.length, news: news.total, requests: handled },
    zones: zones.map(({ zone, status, residents }) => ({ zone, status, residents })),
  };

  return <CinematicLanding data={data} />;
}
