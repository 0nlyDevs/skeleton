import Link from "@/components/ui/link";
import type { Translator } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AgentDashboardDto } from "@/modules/stats/agent-dashboard";

function hours(value: number | null, t: Translator): string {
  if (value === null) return "—";
  return value < 48 ? t("tn.dash.hours", { count: String(value).replace(".", ",") }) : t("tn.dash.days", { count: String(Math.round(value / 24)) });
}

/**
 * F50 — the whole day in three levels: what needs me now (big), how the work
 * flows (medium), and the 14-day picture (small). Every figure is a plain
 * sentence, and each count that can be acted on is a link.
 */
export function ActivityDashboard({ data, t }: { readonly data: AgentDashboardDto; readonly t: Translator }) {
  const top = Math.max(1, ...data.chart.flatMap((point) => [point.received, point.resolved]));
  const needs = [
    { value: data.open.awaitingPickup, label: t("tn.dash.pickup"), href: "/agent/requests?scope=unassigned&status=OPEN" },
    { value: data.open.new, label: t("tn.dash.new"), href: "/agent/requests?status=NEW" },
    { value: data.open.waitingCitizen, label: t("tn.dash.waiting"), href: "/agent/requests?status=WAITING_CITIZEN" },
    { value: data.commentsToRead, label: t("tn.dash.comments"), href: "/agent/feedback" },
  ];
  const world = [
    { value: data.appointmentsToday, label: t("tn.dash.appointments"), href: "/agent/appointments" },
    { value: data.activeAlerts, label: t("tn.dash.alerts"), href: "/agent/alerts/new" },
    { value: data.disruptedServices, label: t("tn.dash.disrupted"), href: "/agent/service-status" },
    ...(data.failedSignIns24h !== null ? [{ value: data.failedSignIns24h, label: t("tn.dash.failed"), href: "/agent/data" }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {data.emergencies > 0 ? (
        <Link href="/agent/requests?status=OPEN" role="alert" className="rounded-2xl border border-error/50 bg-error/10 px-5 py-3 font-semibold text-error">
          {t("tn.dash.emergencies", { count: data.emergencies })}
        </Link>
      ) : null}

      <section aria-labelledby="dash-now" className="flex flex-col gap-3">
        <h2 id="dash-now" className="px-1 text-lg font-semibold">{t("tn.dash.now")}</h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {needs.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className={cn("flex h-full flex-col gap-1 rounded-2xl p-4 shadow-panel hover:bg-accent", item.value > 0 ? "bg-card" : "bg-surface-muted")}>
                <span className="text-4xl font-semibold tabular-nums">{item.value}</span>
                <span className="text-[0.875rem] text-muted-foreground">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dash-flow" className="grid gap-3 md:grid-cols-3">
        <h2 id="dash-flow" className="sr-only">{t("tn.dash.flow")}</h2>
        <div className="rounded-2xl bg-card p-4 shadow-panel">
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.dash.received")}</p>
          <p className="text-xl font-semibold tabular-nums">{t("tn.dash.received_value", { today: data.received.today, week: data.received.week })}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-panel">
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.dash.first_answer")}</p>
          <p className="text-xl font-semibold tabular-nums">{hours(data.averages.firstAnswerHours, t)}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-panel">
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.dash.resolution")}</p>
          <p className="text-xl font-semibold tabular-nums">{hours(data.averages.resolutionHours, t)}</p>
        </div>
      </section>

      <section aria-labelledby="dash-city" className="flex flex-col gap-3">
        <h2 id="dash-city" className="px-1 text-lg font-semibold">{t("tn.dash.city")}</h2>
        <ul className="flex flex-wrap gap-2">
          {world.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="flex items-baseline gap-2 rounded-full bg-card px-4 py-2 text-sm shadow-panel hover:bg-accent">
                <span className="text-lg font-semibold tabular-nums">{item.value}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dash-chart" className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-panel">
        <h2 id="dash-chart" className="font-semibold">{t("tn.dash.chart")}</h2>
        <div className="flex h-28 items-end gap-1.5" role="img" aria-label={t("tn.dash.chart_alt", { received: data.chart.reduce((s, p) => s + p.received, 0), resolved: data.chart.reduce((s, p) => s + p.resolved, 0) })}>
          {data.chart.map((point) => (
            <div key={point.day} className="flex h-full flex-1 items-end gap-0.5" title={`${point.day} : ${point.received} / ${point.resolved}`}>
              <span className="w-1/2 rounded-t bg-foreground" style={{ height: `${(point.received / top) * 100}%`, minHeight: point.received > 0 ? 3 : 0 }} />
              <span className="w-1/2 rounded-t border border-foreground/60" style={{ height: `${(point.resolved / top) * 100}%`, minHeight: point.resolved > 0 ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <p className="flex gap-4 text-[0.75rem] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-foreground" aria-hidden />{t("tn.dash.chart_received")}</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-foreground/60" aria-hidden />{t("tn.dash.chart_resolved")}</span>
        </p>
      </section>
    </div>
  );
}
