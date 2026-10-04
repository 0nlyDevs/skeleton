"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import type { CityRequestSummaryDto } from "@/modules/city-requests/city-requests.dto";
import { suggestPriority } from "@/modules/city-requests/city-requests.priority";

import { RequestPriorityBadge, RequestStatusBadge } from "@/components/city/request-badges";

/**
 * F80 — the city's work, ranked. Each row proposes a priority with its reasons
 * (waiting without an agent, backed by residents, urgent words, a safety or
 * water problem) and applies it in one tap; the agent stays free to ignore it.
 */
export function PriorityPanel() {
  const t = useTranslation();
  const [items, setItems] = useState<CityRequestSummaryDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const page = await apiFetch<{ data: CityRequestSummaryDto[] }>("/api/city-requests?scope=all&status=OPEN&sort=priority&limit=10");
      setItems(page.data);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (reference: string, priority: string) => {
    setBusy(reference);
    try {
      await apiFetch(`/api/city-requests/${reference}`, { method: "PATCH", body: { priority } });
      setItems((current) => (current ? current.map((item) => (item.reference === reference ? { ...item, priority } : item)) : current));
      toast.success(t("tn.agent.priority.applied"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  const ranked = (items ?? [])
    .map((request) => ({
      request,
      suggestion: suggestPriority({
        createdAt: request.createdAt,
        assigneeId: request.assignee?.id ?? null,
        issueType: request.issueType,
        supportCount: request.supportCount,
        subject: request.subject,
      }),
    }))
    .filter((entry) => entry.suggestion.priority !== entry.request.priority)
    .sort((a, b) => b.suggestion.score - a.suggestion.score)
    .slice(0, 5);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="priority-panel">
      <div className="flex flex-col gap-0.5">
        <h2 id="priority-panel" className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-warning" aria-hidden />
          {t("tn.agent.priority.title")}
        </h2>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.agent.priority.subtitle")}</p>
      </div>

      {failed ? (
        <Button size="sm" variant="secondary" onClick={() => void load()}>{t("common.retry")}</Button>
      ) : !items ? (
        <p className="text-[0.8125rem] text-muted-foreground">{t("common.loading")}</p>
      ) : ranked.length === 0 ? (
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.agent.priority.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ranked.map(({ request, suggestion }) => (
            <li key={request.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[0.75rem] text-muted-foreground">{request.reference}</span>
                  <RequestStatusBadge status={request.status} />
                  <RequestPriorityBadge priority={request.priority} />
                </span>
                <span className="mt-0.5 block truncate text-[0.8438rem] font-medium">{request.subject}</span>
                <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">
                  {t("tn.agent.priority.suggest", { priority: t(`tn.priority.${suggestion.priority}` as MessageKey) })}
                  {suggestion.reasons.length > 0
                    ? ` · ${suggestion.reasons.map((reason) => t(`tn.agent.req.reason.${reason}` as MessageKey)).join(" · ")}`
                    : ""}
                </span>
              </span>
              <Button size="sm" variant="secondary" disabled={busy === request.reference} onClick={() => void apply(request.reference, suggestion.priority)}>
                <ArrowUp aria-hidden />
                {t("tn.agent.priority.apply")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
