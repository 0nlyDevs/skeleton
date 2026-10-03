import type { Metadata } from "next";

import { CinematicLanding, type LandingData } from "@/components/cinematic/cinematic-landing";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { countHandledCityRequests } from "@/modules/city-requests/city-requests.service";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: { absolute: "Terra Nova — portail des habitants" } };

/**
 * D07 — the front door. A cinematic intro (Earth becoming Terra Nova), then
 * the portal's essentials in order: what you can do, the city's services,
 * the agents' workspace, the latest announcements. Every figure and card is
 * real data, rendered on the server; the animation only stages it.
 */
export default async function LandingPage() {
  const context = await getAuthContext();
  const user = context?.user ?? null;
  const { locale } = await getServerDictionary();
  const [services, news, handled] = await Promise.all([
    listServices({}, user, locale),
    listAnnouncements({ page: 1, limit: 3 }, user),
    countHandledCityRequests(),
  ]);

  const data: LandingData = {
    viewer: user ? { firstName: user.name.split(" ")[0] ?? user.name, staff: isStaff(user) } : null,
    services: services.slice(0, 6).map(({ slug, name, summary, icon, category }) => ({ slug, name, summary, icon, category })),
    news: news.data.map(({ slug, title, summary, category, publishedAt }) => ({ slug, title, summary, category, publishedAt })),
    stats: { services: services.length, news: news.total, requests: handled },
  };

  return <CinematicLanding data={data} />;
}
