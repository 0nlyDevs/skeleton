"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import type { MessageKey } from "@/lib/i18n";
import type { CityRequestEventDto } from "@/modules/city-requests/city-requests.dto";

/** The request's history: creation, status, priority and assignment changes. */
export function RequestTimeline({ events }: { readonly events: readonly CityRequestEventDto[] }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const label = (kind: "status" | "priority", value: string | null) =>
    value ? t(`tn.${kind}.${value}` as MessageKey) : "-";

  const describe = (event: CityRequestEventDto): string => {
    if (event.kind === "created") return t("tn.request.event.created");
    if (event.kind === "status") return t("tn.request.event.status", { from: label("status", event.from), to: label("status", event.to) });
    if (event.kind === "priority") return t("tn.request.event.priority", { from: label("priority", event.from), to: label("priority", event.to) });
    if (event.kind === "assignee") return event.to ? t("tn.request.event.assignee_set", { to: event.to }) : t("tn.request.event.assignee_unset");
    return event.kind;
  };

  return (
    <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
      {events.map((event, index) => (
        <li key={`${event.createdAt}-${index}`} className="relative text-[0.8125rem]">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
          <p className="font-medium">{describe(event)}</p>
          <p className="text-[0.75rem] text-muted-foreground">
            <time dateTime={event.createdAt}>{fmt.dateTime(event.createdAt)}</time>
            {event.actor ? ` · ${t("tn.request.by", { name: event.actor })}` : null}
          </p>
        </li>
      ))}
    </ol>
  );
}
