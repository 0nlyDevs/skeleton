"use client";

import { Loader2, UserCheck, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import type { CityRequestDto } from "@/modules/city-requests/city-requests.dto";
import { CITY_REQUEST_PRIORITIES, CITY_REQUEST_STATUSES } from "@/modules/city-requests/city-requests.schema";

const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius-control)] border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60";

/** Agent-only handling panel: status, priority and who is in charge. */
export function RequestControls({
  request,
  viewerId,
  onUpdated,
}: {
  readonly request: CityRequestDto;
  readonly viewerId: string;
  readonly onUpdated: (request: CityRequestDto) => void;
}) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);

  const update = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const response = await apiFetch<{ data: CityRequestDto }>(`/api/city-requests/${request.reference}`, { method: "PATCH", body });
      onUpdated(response.data);
      toast.success(t("tn.agent.req.updated"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const mine = request.assignee?.id === viewerId;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="handling">
      <h2 id="handling" className="flex items-center gap-2 font-semibold">
        {t("tn.agent.req.manage")}
        {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
      </h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-status">{t("tn.agent.req.status")}</Label>
        <select id="request-status" className={SELECT_CLASS} value={request.status} disabled={busy} onChange={(event) => void update({ status: event.target.value })}>
          {CITY_REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>{t(`tn.status.${status}` as MessageKey)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-priority">{t("tn.agent.req.priority")}</Label>
        <select id="request-priority" className={SELECT_CLASS} value={request.priority} disabled={busy} onChange={(event) => void update({ priority: event.target.value })}>
          {CITY_REQUEST_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>{t(`tn.priority.${priority}` as MessageKey)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("tn.agent.req.assignee")}</span>
        <p className="text-sm text-muted-foreground">{request.assignee?.name ?? t("tn.agent.inbox.unassigned")}</p>
        {mine ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void update({ assignee: null })}>
            <UserMinus aria-hidden />
            {t("tn.agent.req.release")}
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => void update({ assignee: "me" })}>
            <UserCheck aria-hidden />
            {t("tn.agent.req.take")}
          </Button>
        )}
      </div>
    </section>
  );
}
