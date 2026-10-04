import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import Link from "@/components/ui/link";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { listSecurityEvents, type SecurityLevel } from "@/modules/security-events/security-events.service";

export const metadata: Metadata = { title: "Événements de sécurité" };

const LEVELS: readonly SecurityLevel[] = ["alert", "notice", "routine"];
const FILL: Readonly<Record<SecurityLevel, string>> = { alert: "full", notice: "half", routine: "ring" };

/** F100 — the latest security events in plain sentences, with the day's summary on top. */
export default async function AgentSecurityPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const asked = (await searchParams).level;
  const level = LEVELS.find((entry) => entry === asked);
  return withAgentAccess("/agent/security", async (user) => {
    const [{ t, locale }, report] = await Promise.all([getServerDictionary(), listSecurityEvents(user, level)]);
    const counts = [
      { key: "failed", value: report.last24h.failedSignIns },
      { key: "locked", value: report.last24h.lockedSignIns },
      { key: "changes", value: report.last24h.sensitiveChanges },
      { key: "forms", value: report.last24h.blockedForms },
    ] as const;
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.security.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.security.subtitle")}</p>
        </header>

        <section aria-label={t("tn.security.today")} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
          <p className={cn("flex items-center gap-2.5 text-[0.9375rem] font-semibold", report.mood === "act" ? "text-error" : report.mood === "watch" ? "text-warning" : "text-success")}>
            <span aria-hidden className="state-bubble" data-fill={report.mood === "calm" ? "ring" : report.mood === "watch" ? "half" : "full"} />
            {t(`tn.security.mood.${report.mood}`)}
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counts.map((count) => (
              <div key={count.key} className="rounded-2xl bg-surface-muted p-3">
                <dd className="text-2xl font-semibold tabular-nums">{count.value}</dd>
                <dt className="text-[0.8125rem] text-muted-foreground">{t(`tn.security.count.${count.key}`)}</dt>
              </div>
            ))}
          </dl>
        </section>

        <nav aria-label={t("tn.security.filter")} className="flex flex-wrap gap-2">
          {[undefined, ...LEVELS].map((entry) => (
            <Link
              key={entry ?? "all"}
              href={entry ? `/agent/security?level=${entry}` : "/agent/security"}
              aria-current={level === entry ? "page" : undefined}
              className={cn("rounded-full px-4 py-2 text-sm font-medium", level === entry ? "bg-foreground text-background" : "bg-surface-muted hover:bg-accent")}
            >
              {t(`tn.security.level.${entry ?? "all"}`)}
            </Link>
          ))}
        </nav>

        {report.events.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("tn.security.empty")}</p>
        ) : (
          <ol className="flex flex-col rounded-2xl bg-card px-5 py-2 shadow-panel">
            {report.events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 border-b border-border/60 py-3 last:border-b-0">
                <span aria-hidden className={cn("state-bubble mt-1 shrink-0", event.level === "alert" ? "text-error" : event.level === "notice" ? "text-warning" : "text-muted-foreground")} data-fill={FILL[event.level]} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", event.level === "alert" && "font-semibold")}>
                    {t(`tn.security.event.${event.kind}` as MessageKey, { actor: event.actor ?? t("tn.security.someone") })}
                  </p>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {formatDateTime(event.createdAt, locale)}
                    {event.origin ? ` · ${t("tn.security.origin", { origin: event.origin })}` : ""}
                    {` · ${t(`tn.security.level.${event.level}`)}`}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  });
}
