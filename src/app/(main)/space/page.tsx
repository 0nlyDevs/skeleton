import { ArrowRight, Building2, FileText, Globe2, Hourglass, MapPin, Pencil, Send, Siren } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

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
import { formatLongDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { WELCOME_HIDDEN_COOKIE, WELCOME_SERVICE_COOKIE, WIZARD_DONE_COOKIE } from "@/lib/onboarding";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { cityRequestStats, listCityRequests } from "@/modules/city-requests/city-requests.service";
import { listServices } from "@/modules/city-services/city-services.service";
import { getZoneStatuses, viewerZone } from "@/modules/alerts/alerts.service";
import { cityZoneLabelKey } from "@/modules/alerts/city-zones";

export const metadata: Metadata = { title: "Mon espace" };

const HISTORY_FILTERS = { all: undefined, open: "OPEN", done: "DONE" } as const;
type HistoryFilter = keyof typeof HISTORY_FILTERS;

/**
 * D03 — the resident's personal space: their details and every request they
 * made. F26 — the history can be narrowed to ongoing or finished requests.
 */
export default async function CitizenSpacePage({ searchParams }: { readonly searchParams: Promise<{ history?: string }> }) {
  const { user } = await requirePageAuth("/space");
  const { t, locale } = await getServerDictionary();
  const raw = (await searchParams).history;
  const history: HistoryFilter = raw === "open" || raw === "done" ? raw : "all";
  const [requests, stats, news, zone, zones] = await Promise.all([
    listCityRequests({ scope: "mine", page: 1, limit: 50, status: HISTORY_FILTERS[history] }, user),
    cityRequestStats(user, "mine"),
    listAnnouncements({ page: 1, limit: 3 }, user),
    viewerZone(user),
    getZoneStatuses(),
  ]);
  const district = zone ? zones.find((entry) => entry.zone === zone) : undefined;
  const waiting = stats.WAITING_CITIZEN ?? 0;

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
  // The wizard opens on the first visit only; the checklist above stays after.
  const showWizard = cookieStore.get(WIZARD_DONE_COOKIE)?.value !== "1" && !onboarded && total === 0;
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

      {showWelcome ? <WelcomeGuide name={user.name.split(" ")[0] ?? user.name} steps={welcome} /> : null}
      {showWizard ? <WelcomeWizard name={user.name.split(" ")[0] ?? user.name} image={user.image} services={wizardServices} /> : null}

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

      {district ? (
        <Link href="/city-map" className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${statusTone[district.status]}`}>
          <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {t("tn.nav.my_district")} · {t(cityZoneLabelKey(district.zone))}
            </span>
            <span className="block text-[0.8125rem] text-muted-foreground">
              {t(`alerts.zone_status.${district.status}` as MessageKey)} — {t(`alerts.zone_status_body.${district.status}` as MessageKey)}
            </span>
          </span>
          <span className="text-[0.8125rem] font-semibold tabular-nums">
            {t("alerts.map.health")} {district.score}/100
          </span>
        </Link>
      ) : (
        <Link href="/settings/profile" className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/50 p-4 hover:bg-accent">
          <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-primary">{t("tn.nav.choose_district")}</span>
            <span className="block text-[0.8125rem] text-muted-foreground">{t("alerts.location.required")}</span>
          </span>
        </Link>
      )}

      {waiting > 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-warning/60 bg-warning/10 px-4 py-3 text-[0.875rem] font-medium" role="status">
          <Hourglass className="size-4 shrink-0" aria-hidden />
          {t("tn.space.attention", { count: waiting })}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3" aria-labelledby="my-requests">
          <h2 id="my-requests" className="px-1 font-semibold">
            <Term id="procedure">{t("tn.space.requests")}</Term>
          </h2>
          {openCount + doneCount > 0 ? (
            <nav aria-label={t("tn.space.history.label")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              {historyTabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.key === "all" ? "/space" : `/space?history=${tab.key}`}
                  aria-current={history === tab.key ? "page" : undefined}
                  scroll={false}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${history === tab.key ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-surface-muted"}`}
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
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="my-details">
            <h2 id="my-details" className="mb-3 font-semibold">{t("tn.space.profile")}</h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.name")}</dt>
                <dd className="font-medium">{user.name}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.email")}</dt>
                <dd className="break-all">{user.email}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.role")}</dt>
                <dd>{t(`role.${user.role.toLowerCase()}` as MessageKey)}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.since")}</dt>
                <dd>{formatLongDate(user.createdAt, locale)}</dd>
              </div>
            </dl>
            <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
              <Link href="/settings/profile">
                <Pencil aria-hidden />
                {t("tn.space.edit_profile")}
              </Link>
            </Button>
            <div className="mt-2 text-center">
              <Link href="/settings/security" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                {t("tn.space.manage_account")}
              </Link>
            </div>
          </section>

          {news.data.length > 0 ? (
            <section className="flex flex-col gap-2.5" aria-labelledby="to-read">
              <div className="flex items-center justify-between px-1">
                <h2 id="to-read" className="font-semibold">{t("tn.space.news")}</h2>
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
