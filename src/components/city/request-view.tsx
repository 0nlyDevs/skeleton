"use client";

import { ArrowLeft, CheckCircle2, Hourglass, Lock } from "lucide-react";
import { useState } from "react";

import { RequestControls } from "@/components/agent/request-controls";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import Link from "@/components/ui/link";
import { useFormatters } from "@/hooks/use-formatters";
import { cn } from "@/lib/utils";
import type { CityRequestDto } from "@/modules/city-requests/city-requests.dto";

import { NeedsActionBadge, RequestPriorityBadge, RequestStatusBadge } from "./request-badges";
import { RequestComposer } from "./request-composer";
import { RequestTimeline } from "./request-timeline";

/**
 * One request, from either side. Citizens see the thread with "Terra Nova
 * services" as the author of answers; agents also see internal notes, the
 * citizen's name and the handling panel. The server decides what each side
 * receives — this component only lays it out.
 */
export function RequestView({
  initial,
  mode,
  viewerId,
  justSent = false,
}: {
  readonly initial: CityRequestDto;
  readonly mode: "citizen" | "agent";
  readonly viewerId: string;
  readonly justSent?: boolean;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [request, setRequest] = useState(initial);
  const agent = mode === "agent";
  const closed = request.status === "CLOSED";

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <Link
        href={agent ? "/agent/demandes" : "/espace"}
        className="inline-flex items-center gap-1.5 px-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {agent ? t("tn.agent.req.back") : t("tn.request.back_space")}
      </Link>

      {justSent ? (
        <div role="status" className="flex gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold">{t("tn.contact.sent_title")}</p>
            <p className="text-sm">{t("tn.contact.sent_body", { reference: request.reference })}</p>
            <p className="text-[12.5px] text-muted-foreground">{t("tn.contact.sent_email")}</p>
          </div>
        </div>
      ) : null}

      {!agent && request.status === "WAITING_CITIZEN" ? (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
          <Hourglass className="size-4 shrink-0" aria-hidden />
          {t("tn.request.waiting_you")}
        </div>
      ) : null}

      <header className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[13px] text-muted-foreground">{request.reference}</span>
          <RequestStatusBadge status={request.status} />
          {agent ? <RequestPriorityBadge priority={request.priority} /> : null}
          {agent && request.needsAction ? <NeedsActionBadge /> : null}
        </div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{request.subject}</h1>
        <p className="text-[13px] text-muted-foreground">
          {request.service?.name ?? t("tn.no_service")} · {t("tn.request.sent_on", { date: fmt.dateTime(request.createdAt) })}
          {agent && request.citizen ? ` · ${t("tn.agent.inbox.citizen")} : ${request.citizen.name}` : null}
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="original">
            <h2 id="original" className="mb-2 text-[13px] font-semibold text-muted-foreground">
              {agent ? t("tn.request.citizen_message") : t("tn.request.your_message")}
            </h2>
            <p className="prose-body text-[15px]">{request.message}</p>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="conversation">
            <h2 id="conversation" className="px-1 font-semibold">{t("tn.request.conversation")}</h2>
            {request.messages.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.request.no_reply")}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {request.messages.map((message) => (
                  <li
                    key={message.id}
                    className={cn(
                      "max-w-[92%] rounded-2xl border px-4 py-3",
                      message.internal
                        ? "self-stretch border-warning/50 bg-warning/10"
                        : message.fromAgent === agent
                          ? "self-end border-primary/30 bg-accent"
                          : "self-start border-border/70 bg-card",
                    )}
                  >
                    <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{message.author.name}</span>
                      {message.internal ? (
                        <Badge variant="warning">
                          <Lock className="size-3" aria-hidden />
                          {t("tn.request.internal_badge")}
                        </Badge>
                      ) : null}
                      <time dateTime={message.createdAt}>{fmt.dateTime(message.createdAt)}</time>
                    </p>
                    <p className="whitespace-pre-line break-words text-[14.5px] [overflow-wrap:anywhere]">{message.body}</p>
                  </li>
                ))}
              </ol>
            )}
            {closed ? (
              <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground">{t("tn.request.closed")}</p>
            ) : (
              <RequestComposer reference={request.reference} allowInternal={agent} onSent={setRequest} />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          {agent ? <RequestControls request={request} viewerId={viewerId} onUpdated={setRequest} /> : null}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="history">
            <h2 id="history" className="mb-3 font-semibold">{t("tn.request.history")}</h2>
            <RequestTimeline events={request.events} />
          </section>
        </aside>
      </div>
    </div>
  );
}
