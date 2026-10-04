import { ArrowRight, CheckCircle2, Clock, Hourglass, Inbox, Radio, Sparkles, UserPlus } from "lucide-react";
import type { Metadata } from "next";

import { ActivityList } from "@/components/agent/activity-list";
import { withAgentAccess } from "@/components/agent/agent-guard";
import { RequestList } from "@/components/city/request-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { formatRelative } from "@/lib/format";
import { getServerDictionary } from "@/lib/i18n/server";
import { listActivity } from "@/modules/activity/activity.service";
import { awaitingPickup, cityRequestStats, listCityRequests } from "@/modules/city-requests/city-requests.service";
import { minutesUntil, nextWaveAt } from "@/modules/webcup/webcup.schedule";
import { getWebcupFeed } from "@/modules/webcup/webcup.service";

export const metadata: Metadata = { title: "Espace agent" };

/** D19/F22 — what needs the city team's attention right now. */
export default async function AgentDashboardPage() {
  return withAgentAccess("/agent", async (user) => {
    const { t, locale } = await getServerDictionary();
    const [pickup, stats, open, feed, recent] = await Promise.all([
      awaitingPickup(user),
      cityRequestStats(user, "all"),
      listCityRequests({ scope: "all", status: "OPEN", sort: "recent", page: 1, limit: 8 }, user),
      getWebcupFeed(user),
      listActivity({ page: 1, limit: 6, category: "all", period: "all" }, user),
    ]);
    const counters = [
      { icon: Sparkles, label: t("tn.agent.dash.new"), value: stats.NEW ?? 0, status: "NEW", tone: "text-primary" },
      { icon: Clock, label: t("tn.agent.dash.in_progress"), value: stats.IN_PROGRESS ?? 0, status: "IN_PROGRESS", tone: "text-warning" },
      { icon: Hourglass, label: t("tn.agent.dash.waiting"), value: stats.WAITING_CITIZEN ?? 0, status: "WAITING_CITIZEN", tone: "text-muted-foreground" },
      { icon: CheckCircle2, label: t("tn.agent.dash.resolved"), value: (stats.RESOLVED ?? 0) + (stats.CLOSED ?? 0), status: "RESOLVED", tone: "text-success" },
    ];
    const session = feed.session;
    const minutesLeft = minutesUntil(nextWaveAt(session?.minutes_until_next_wave, feed.lastSuccessAt));

    return (
      <div className="flex flex-col gap-5">
        {/* D17 — the backlog first: how many requests still have no agent. */}
        <section
          aria-labelledby="pickup-title"
          className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-panel sm:flex-row sm:items-center ${pickup.count > 0 ? "border-warning/60 bg-warning/10" : "border-success/40 bg-success/10"}`}
        >
          <span className="text-4xl font-semibold tabular-nums" aria-hidden>{pickup.count}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id="pickup-title" className="font-semibold">
              {pickup.count > 0 ? t("tn.agent.pickup.title", { count: pickup.count }) : t("tn.agent.pickup.none")}
            </h2>
            {pickup.count > 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground">
                {t("tn.agent.pickup.body")} {pickup.oldestAt ? t("tn.agent.pickup.oldest", { when: formatRelative(pickup.oldestAt, locale) }) : null}
              </p>
            ) : null}
          </div>
          {pickup.count > 0 ? (
            <Button asChild size="sm" className="shrink-0">
              <Link href="/agent/requests?scope=unassigned&status=OPEN">
                <UserPlus aria-hidden />
                {t("tn.agent.pickup.open")}
              </Link>
            </Button>
          ) : null}
        </section>

        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {counters.map((counter) => (
            <li key={counter.status}>
              <Link
                href={`/agent/requests?status=${counter.status}`}
                className="flex h-full flex-col gap-1 rounded-2xl border border-border/70 bg-card p-4 shadow-panel hover:border-primary/40"
              >
                <counter.icon className={`size-4 ${counter.tone}`} aria-hidden />
                <span className="text-2xl font-semibold tabular-nums">{counter.value}</span>
                <span className="text-[0.7812rem] text-muted-foreground">{counter.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="flex flex-col gap-3" aria-labelledby="to-handle">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 id="to-handle" className="font-semibold">{t("tn.agent.dash.needs_action")}</h2>
              <Link href="/agent/requests?status=OPEN" className="inline-flex items-center gap-1 text-[0.8125rem] text-primary hover:underline">
                {t("tn.agent.dash.open_inbox")}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            {open.data.length === 0 ? (
              <EmptyState icon={Inbox} title={t("tn.agent.dash.empty")} />
            ) : (
              <RequestList requests={open.data} hrefBase="/agent/requests" agentView />
            )}
          </section>

          <section className="flex h-fit flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="feed-card">
            <h2 id="feed-card" className="flex items-center gap-2 font-semibold">
              <Radio className="size-4 text-primary" aria-hidden />
              {t("tn.agent.dash.feed")}
            </h2>
            <p className="text-sm">{t("tn.agent.dash.feed_body", { count: feed.totals.count, xp: feed.totals.xpVisible })}</p>
            {session && typeof session.current_wave === "number" ? (
              <p className="text-[0.8125rem] text-muted-foreground">
                {t("tn.agent.dash.feed_wave", { wave: session.current_wave, minutes: minutesLeft ?? "—" })}
              </p>
            ) : null}
            {!feed.configured ? <p className="text-[0.8125rem] text-warning">{t("tn.agent.feed.not_configured")}</p> : null}
            <Button asChild size="sm" variant="secondary">
              <Link href="/agent/feed">{t("tn.agent.dash.open_feed")}</Link>
            </Button>
          </section>
        </div>

        {/* D21 — who did what lately, one click from the full history. */}
        <section className="flex flex-col gap-3" aria-labelledby="recent-activity">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 id="recent-activity" className="font-semibold">{t("tn.history.recent")}</h2>
            <Link href="/agent/history" className="inline-flex items-center gap-1 text-[0.8125rem] text-primary hover:underline">
              {t("tn.history.see_all")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {recent.data.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.history.empty")}</p>
          ) : (
            <ActivityList entries={recent.data} groupByDay={false} />
          )}
        </section>
      </div>
    );
  });
}
