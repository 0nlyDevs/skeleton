import { Ambulance, ArrowRight, Building2, FileText, Globe2, Hourglass, MapPin, Pencil, Send, Siren } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ServiceFinder } from "@/components/city/service-finder";
import { AnnouncementCard } from "@/components/city/announcement-card";
import { RequestList } from "@/components/city/request-list";
import { WelcomeGuide } from "@/components/city/welcome-guide";
import { WelcomeWizard } from "@/components/city/welcome-wizard";
import { ContextTip } from "@/components/feedback/context-tip";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Term } from "@/components/ui/term";
import { requirePageAuth } from "@/lib/auth/page-guards";
import type { MessageKey } from "@/lib/i18n";
import { WELCOME_HIDDEN_COOKIE, WELCOME_SERVICE_COOKIE } from "@/lib/onboarding";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { cityRequestStats, listCityRequests } from "@/modules/city-requests/city-requests.service";
import { listServices } from "@/modules/city-services/city-services.service";
import { getZoneStatuses, viewerZone } from "@/modules/alerts/alerts.service";
import { cityZoneLabelKey } from "@/modules/alerts/city-zones";
import { needsOnboarding } from "@/modules/users/users.service";

export const metadata: Metadata = { title: "Mon espace" };

const HISTORY_FILTERS = { all: undefined, open: "OPEN", done: "DONE" } as const;
type HistoryFilter = keyof typeof HISTORY_FILTERS;

/**
 * D03 — the resident's personal space: their details and every request they
 * made. F26 — the history can be narrowed to ongoing or finished requests.
 */
export default async function CitizenSpacePage({ searchParams }: { readonly searchParams: Promise<{ history?: string; guide?: string }> }) {
  const { user } = await requirePageAuth("/space");
  const { t, locale } = await getServerDictionary();
  const params = await searchParams;
  const raw = params.history;
  const history: HistoryFilter = raw === "open" || raw === "done" ? raw : "all";
  const [requests, stats, news, zone, zones, firstVisit] = await Promise.all([
    listCityRequests({ scope: "mine", page: 1, limit: 50, sort: "recent", status: HISTORY_FILTERS[history] }, user),
    cityRequestStats(user, "mine"),
    listAnnouncements({ page: 1, limit: 3 }, user),
    viewerZone(user),
    getZoneStatuses(),
    needsOnboarding(user.id),
  ]);
  const district = zone ? zones.find((entry) => entry.zone === zone) : undefined;
  const waiting = stats.WAITING_CITIZEN ?? 0;
  // The ones that need me first (the city waits for my answer), then those under way.
  const followUp = [...requests.data]
    .filter((request) => request.status === "WAITING_CITIZEN" || request.status === "IN_PROGRESS" || request.status === "NEW")
    .sort((a, b) => Number(b.status === "WAITING_CITIZEN") - Number(a.status === "WAITING_CITIZEN"))
    .slice(0, 3);

  const openCount = (stats.NEW ?? 0) + (stats.IN_PROGRESS ?? 0) + (stats.WAITING_CITIZEN ?? 0);
  const doneCount = (stats.RESOLVED ?? 0) + (stats.CLOSED ?? 0);
  // D12 — the first-steps guide stays until every step is done or it is hidden.
  const cookieStore = await cookies();
  const total = openCount + doneCount;
  const welcome = {
    profile: Boolean(user.image),
    service: cookieStore.get(WELCOME_SERVICE_COOKIE)?.value === "1" || requests.data.some((request) => request.service !== null),
    request: total > 0,
  };
  const onboarded = welcome.profile && welcome.service && welcome.request;
  const showWelcome = cookieStore.get(WELCOME_HIDDEN_COOKIE)?.value !== "1" && !onboarded;
  // D12 — once per account (saved on the user), or again on demand from the top bar.
  const showWizard = params.guide === "1" || firstVisit;
  const wizardServices = showWizard
    ? (await listServices({}, user, locale))
        .slice(0, 3)
        .map(({ slug, name, summary, icon }) => ({ slug, name, summary, icon }))
    : [];

  const historyTabs: { key: HistoryFilter; label: string }[] = [
    { key: "all", label: t("tn.space.history.all", { count: openCount + doneCount }) },
    { key: "open", label: t("tn.space.history.open", { count: openCount }) },
    { key: "done", label: t("tn.space.history.done", { count: doneCount }) },
  ];

  // The things people come to do, in plain words, first on the page.
  const actions = [
    { href: "/contact", icon: Send, title: t("tn.space.do.request"), body: t("tn.space.do.request_body") },
    { href: "/services", icon: Building2, title: t("tn.space.do.services"), body: t("tn.space.do.services_body") },
    { href: "/alerts", icon: Siren, title: t("tn.space.do.alerts"), body: t("tn.space.do.alerts_body") },
    { href: "/city-map", icon: Globe2, title: t("tn.space.do.map"), body: t("tn.space.do.map_body") },
  ];
  const statusTone = { SAFE: "border-success/40 bg-success/8", WATCH: "border-primary/40 bg-accent", WARNING: "border-warning/50 bg-warning/10", DANGER: "border-error/50 bg-error/10" } as const;

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.home.hello", { name: user.name.split(" ")[0] ?? user.name })}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.space.question")}</p>
      </header>

      <Link href="/city-map" className="map-hero group relative flex min-h-[11.5rem] flex-col justify-end gap-2 overflow-hidden rounded-2xl p-6 text-white shadow-float">
        <span aria-hidden className="map-hero-island" />
        <span className="relative text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/80">{t("tn.space.map_hero.eyebrow")}</span>
        <span className="relative max-w-xl text-2xl font-semibold leading-tight [font-family:var(--font-display)]">{t("tn.space.map_hero.title")}</span>
        <span className="relative max-w-xl text-sm text-white/85">{t("tn.space.map_hero.body")}</span>
        <span className="relative mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0b0d12] transition-transform group-hover:translate-x-1">
          <Globe2 className="size-4" aria-hidden />
          {t("tn.space.map_hero.cta")}
        </span>
      </Link>

      {showWelcome ? <WelcomeGuide name={user.name.split(" ")[0] ?? user.name} steps={welcome} /> : null}
      {showWizard ? <WelcomeWizard name={user.name.split(" ")[0] ?? user.name} image={user.image} services={wizardServices} /> : null}

      <ServiceFinder />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t("tn.space.question")}>
        {actions.map((action) => (
          <li key={action.href}>
            <Link href={action.href} className="group flex h-full flex-col gap-2 rounded-2xl border border-border/70 bg-card p-4 shadow-panel transition-colors hover:border-primary/50">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
                <action.icon className="size-5" aria-hidden />
              </span>
              <span className="flex items-center gap-1 font-semibold">
                {action.title}
                <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
              <span className="text-[0.8125rem] leading-snug text-muted-foreground">{action.body}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* One quiet line: where I live and how it is, and where to go in an emergency. */}
      <div className="flex flex-wrap gap-2">
        {district ? (
          <Link href="/city-map" className={`flex min-w-0 items-center gap-2.5 rounded-full border px-4 py-2 text-[0.875rem] ${statusTone[district.status]}`}>
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              <span className="font-semibold">{t(cityZoneLabelKey(district.zone))}</span>
              <span className="text-muted-foreground"> · {t(`alerts.zone_status.${district.status}` as MessageKey)}</span>
            </span>
          </Link>
        ) : (
          <Link href="/settings/profile" className="flex items-center gap-2.5 rounded-full border border-dashed border-foreground/40 px-4 py-2 text-[0.875rem] font-semibold hover:bg-accent">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {t("tn.nav.choose_district")}
          </Link>
        )}
        <Link href="/city-map?layer=emergency" className="flex items-center gap-2.5 rounded-full border border-error/40 px-4 py-2 text-[0.875rem] font-semibold text-error hover:bg-error/10">
          <Ambulance className="size-4 shrink-0" aria-hidden />
          {t("alerts.map.emergency_title")}
        </Link>
      </div>

      {waiting > 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-warning/60 bg-warning/10 px-4 py-3 text-[0.875rem] font-medium" role="status">
          <Hourglass className="size-4 shrink-0" aria-hidden />
          {t("tn.space.attention", { count: waiting })}
        </p>
      ) : null}

      {/* What needs me now: the requests waiting for my answer first, then the most recent ones under way. */}
      {followUp.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="follow-up">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 id="follow-up" className="text-lg font-semibold">{t("tn.space.follow")}</h2>
            <Link href="/space?history=open" className="text-[0.8125rem] font-medium text-primary hover:underline">{t("tn.see_all")}</Link>
          </div>
          <RequestList requests={followUp} hrefBase="/space/requests" />
        </section>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3" aria-labelledby="my-requests">
          <h2 id="my-requests" className="px-1 text-lg font-semibold">
            <Term id="procedure">{t("tn.space.requests")}</Term>
          </h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[0.8125rem] font-medium">
            {openCount + doneCount > 0 ? (
              <Link href="/space/summary" className="text-primary underline underline-offset-2">
                {t("tn.summary.link")}
              </Link>
            ) : null}
            {/* F76 — the comments the resident left on services, and their follow-up. */}
            <Link href="/space/feedback" className="text-primary underline underline-offset-2">
              {t("tn.feedback.mine.link")}
            </Link>
          </p>
          {openCount + doneCount > 0 ? (
            <nav aria-label={t("tn.space.history.label")} className="flex flex-wrap gap-2">
              {historyTabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.key === "all" ? "/space" : `/space?history=${tab.key}`}
                  aria-current={history === tab.key ? "page" : undefined}
                  scroll={false}
                  className={`rounded-full px-4 py-2 text-[0.875rem] font-medium transition-colors ${history === tab.key ? "bg-foreground text-background" : "bg-card hover:bg-accent"}`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {requests.data.length === 0 && history !== "all" ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.space.history.empty")}</p>
          ) : requests.data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("tn.space.empty_title")}
              description={t("tn.space.empty_body")}
              action={
                <Button asChild size="sm">
                  <Link href="/contact">{t("tn.space.new_request")}</Link>
                </Button>
              }
            />
          ) : (
            <>
              <ContextTip id="space">{t("tn.tip.space")}</ContextTip>
              <RequestList requests={requests.data} hrefBase="/space/requests" />
            </>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <section className="rounded-2xl bg-card p-4 shadow-panel" aria-labelledby="my-account">
            <h2 id="my-account" className="mb-2 px-1 text-lg font-semibold">{t("tn.space.profile")}</h2>
            <ul className="flex flex-col">
              {[
                { href: "/settings/profile", label: t("tn.space.edit_profile"), icon: Pencil },
                { href: "/space/feedback", label: t("tn.feedback.mine.title"), icon: FileText },
                { href: "/appointments", label: t("tn.appointments.nav"), icon: Hourglass },
                { href: "/settings/security", label: t("tn.space.manage_account"), icon: Siren },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[0.9375rem] font-medium hover:bg-surface-muted">
                    <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {news.data.length > 0 ? (
            <section className="flex flex-col gap-2.5" aria-labelledby="to-read">
              <div className="flex items-center justify-between px-1">
                <h2 id="to-read" className="text-lg font-semibold">{t("tn.space.news")}</h2>
                <Link href="/announcements" className="text-[0.8125rem] text-primary hover:underline">{t("tn.see_all")}</Link>
              </div>
              {news.data.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} compact />
              ))}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
