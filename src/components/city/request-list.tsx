"use client";

import { ChevronRight } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { useFormatters } from "@/hooks/use-formatters";
import { cn } from "@/lib/utils";
import type { CityRequestSummaryDto } from "@/modules/city-requests/city-requests.dto";

import { NeedsActionBadge, RequestPriorityBadge, RequestStatusBadge } from "./request-badges";

/**
 * A list of request summaries. `hrefBase` decides which space opens the
 * request (`/space/requests` for citizens, `/agent/requests` for agents);
 * agent rows also show the citizen, the agent in charge and "action needed".
 */
export function RequestList({
  requests,
  hrefBase,
  agentView = false,
}: {
  readonly requests: readonly CityRequestSummaryDto[];
  readonly hrefBase: string;
  readonly agentView?: boolean;
}) {
  const t = useTranslation();
  const fmt = useFormatters();

  return (
    <ul className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel">
      {requests.map((request) => {
        const waitingCitizen = !agentView && request.status === "WAITING_CITIZEN";
        return (
          <li key={request.id}>
            <Link
              href={`${hrefBase}/${request.reference}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted",
                agentView && request.needsAction && "border-l-4 border-l-error",
                waitingCitizen && "border-l-4 border-l-warning",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[0.75rem] text-muted-foreground">{request.reference}</span>
                  <RequestStatusBadge status={request.status} />
                  {agentView ? <RequestPriorityBadge priority={request.priority} /> : null}
                  {agentView && request.needsAction ? <NeedsActionBadge /> : null}
                </span>
                <span className="truncate font-medium">{request.subject}</span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7812rem] text-muted-foreground">
                  <span>{request.service?.name ?? t("tn.no_service")}</span>
                  {agentView && request.citizen ? <span>{t("tn.agent.inbox.citizen")} : {request.citizen.name}</span> : null}
                  {agentView ? (
                    <span>
                      {t("tn.agent.inbox.assignee")} : {request.assignee?.name ?? t("tn.agent.inbox.unassigned")}
                    </span>
                  ) : null}
                  <time dateTime={request.updatedAt} title={fmt.dateTime(request.updatedAt)}>
                    {t("tn.agent.inbox.updated")} {fmt.relative(request.updatedAt)}
                  </time>
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
