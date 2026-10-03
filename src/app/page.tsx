import type { Metadata } from "next";

import { CinematicLanding, type LandingData, type RegistryRequest } from "@/components/cinematic/cinematic-landing";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/http/safe-redirect";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { getZoneStatuses } from "@/modules/alerts/alerts.service";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { cityRequestStats, countHandledCityRequests } from "@/modules/city-requests/city-requests.service";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: { absolute: "Terra Nova — portail des habitants" } };

/** Why a visitor was sent back to the registry, as the auth server or a provider words it. */
const REDIRECT_ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  INVALID_EMAIL_OR_PASSWORD: "auth.login.failed",
  EMAIL_NOT_VERIFIED: "auth.login.unverified",
  BANNED_USER: "auth.login.banned",
  TOO_MANY_REQUESTS: "auth.login.too_many",
  access_denied: "auth.oauth.cancelled",
  account_not_linked: "auth.oauth.not_linked",
  unable_to_link_account: "auth.oauth.not_linked",
  email_not_verified: "auth.oauth.not_linked",
  email_not_found: "auth.oauth.no_email",
  state_not_found: "auth.oauth.expired",
  state_mismatch: "auth.oauth.expired",
  please_restart_the_process: "auth.oauth.expired",
};

/**
 * D07 — the front door. An arrival from orbit, then a flight over the island
 * where each district presents one part of the portal: what you can do, the
 * city's services, how to write to city hall, the latest announcements, live
 * figures, the agents' workspace, the state of the districts. Every figure and
 * card is real data, rendered on the server; the animation only stages it.
 *
 * It is also where residents sign in: `?registre=connexion` (what `/login`
 * forwards to) or `?registre=inscription` opens the citizens' registry.
 */
export default async function LandingPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
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

  // A signed-in resident has no use for the registry: the request is dropped.
  const view = user ? null : params.registre === "inscription" ? "register" : params.registre === "connexion" ? "signin" : null;
  const rawError = typeof params.error === "string" ? params.error : null;
  const registry: RegistryRequest | null = view
    ? {
        view,
        redirectTo: safeNextPath(typeof params.next === "string" ? params.next : null),
        errorKey: rawError ? (REDIRECT_ERROR_KEYS[rawError] ?? "auth.oauth.failed") : null,
      }
    : null;

  return <CinematicLanding data={data} registry={registry} oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }} />;
}
