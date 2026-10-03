"use client";

import { CheckCircle2, Lock, MapPin, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { RequestControls } from "@/components/agent/request-controls";
import { ContextTip } from "@/components/feedback/context-tip";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import Link from "@/components/ui/link";
import { Term } from "@/components/ui/term";
import { useFormatters } from "@/hooks/use-formatters";
import { useSocket } from "@/hooks/use-socket";
import type { MessageKey } from "@/lib/i18n";
import { apiFetch } from "@/lib/api/client";
import { SOCKET_EVENTS, type CityRequestUpdatedPayload } from "@/lib/socket/events";
import { cn } from "@/lib/utils";
import type { CityRequestDto } from "@/modules/city-requests/city-requests.dto";

import { FeedbackForm } from "./feedback-form";
import { TerraNovaMap } from "./terra-nova-map";
import { NeedsActionBadge, RequestPriorityBadge, RequestStatusBadge } from "./request-badges";
import { RequestComposer } from "./request-composer";
import { RequestProgress } from "./request-progress";
import { RequestStatusGuide } from "./request-status-guide";
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
  const { socket } = useSocket();
  const agent = mode === "agent";
  const reference = initial.reference;

  const reload = useCallback(async () => {
    try {
      setRequest((await apiFetch<{ data: CityRequestDto }>(`/api/city-requests/${reference}`)).data);
    } catch {
      // The next push or poll tries again; the thread on screen stays.
    }
  }, [reference]);

  // The other side answered: append it without a page reload.
  useEffect(() => {
    if (!socket) return;
    const onUpdated = (payload: CityRequestUpdatedPayload) => {
      if (payload.reference === reference) void reload();
    };
    socket.on(SOCKET_EVENTS.cityRequestUpdated, onUpdated);
    return () => {
      socket.off(SOCKET_EVENTS.cityRequestUpdated, onUpdated);
    };
  }, [socket, reference, reload]);

  // Safety net when the realtime channel is down or a push was missed.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 20_000);
    return () => clearInterval(timer);
  }, [reload]);
  const closed = request.status === "CLOSED";

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      {/* D15 — agents get the same path in the workspace header. */}
      {agent ? null : (
        <Breadcrumbs
          label={t("tn.breadcrumb.label")}
          items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.nav.my_space"), href: "/space" }, { label: request.reference }]}
        />
      )}

      {justSent ? (
        <div role="status" className="flex gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold">{t("tn.contact.sent_title")}</p>
            <p className="text-sm">{t("tn.contact.sent_body", { reference: request.reference })}</p>
            <p className="text-[0.7812rem] text-muted-foreground">{t("tn.contact.sent_email")}</p>
          </div>
        </div>
      ) : null}

      {/* F49 — what the current state means and what to do, for the resident. */}
      {!agent ? <RequestStatusGuide status={request.status} /> : null}

      {/* F76 — once the request is over, the resident can say how it went. */}
      {!agent && request.service && (request.status === "RESOLVED" || request.status === "CLOSED") ? (
        request.feedback ? (
          <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
            {t("tn.feedback.request_done", { reference: request.feedback.reference })}
            <Link href={`/space/feedback#${request.feedback.reference}`} className="font-medium text-primary hover:underline">
              {t("tn.feedback.follow")}
            </Link>
          </p>
        ) : (
          <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="request-feedback">
            <div className="flex flex-col gap-0.5">
              <h2 id="request-feedback" className="font-semibold">{t("tn.feedback.request_title")}</h2>
              <p className="text-[0.8438rem] text-muted-foreground">{t("tn.feedback.request_body", { service: request.service.name })}</p>
            </div>
            <FeedbackForm serviceSlug={request.service.slug} serviceName={request.service.name} requestReference={request.reference} idPrefix="request-feedback" />
          </section>
        )
      ) : null}

      <header className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Term id="reference" className="font-mono text-[0.8125rem] text-muted-foreground">{request.reference}</Term>
          <RequestStatusBadge status={request.status} />
          {agent ? <RequestPriorityBadge priority={request.priority} /> : null}
          {agent && request.needsAction ? <NeedsActionBadge /> : null}
        </div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{request.subject}</h1>
        <p className="text-[0.8125rem] text-muted-foreground">
          {request.service?.name ?? t("tn.no_service")} · {t("tn.request.sent_on", { date: fmt.dateTime(request.createdAt) })}
          {agent && request.citizen ? ` · ${t("tn.agent.inbox.citizen")} : ${request.citizen.name}` : null}
        </p>
      </header>

      <section className="rounded-2xl border border-border/70 bg-card px-3 py-4 shadow-panel" aria-label={t("tn.progress.label")}>
        <RequestProgress status={request.status} assigned={request.assignee !== null} />
      </section>

      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="original">
            <h2 id="original" className="mb-2 text-[0.8125rem] font-semibold text-muted-foreground">
              {agent ? t("tn.request.citizen_message") : t("tn.request.your_message")}
            </h2>
            <p className="prose-body text-[0.9375rem]">{request.message}</p>
          </section>

          {request.issueType ? (
            <section className="flex flex-col gap-2 rounded-2xl border border-warning/50 bg-warning/10 p-4" aria-labelledby="report">
              <h2 id="report" className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                <TriangleAlert className="size-4" aria-hidden />
                {t("tn.request.report")} · {t(`tn.issue.${request.issueType}` as MessageKey)}
              </h2>
              {request.location || request.mapX !== null ? (
                <div className="flex flex-col gap-2 text-sm">
                  <span className="text-[0.75rem] text-muted-foreground">{t("tn.request.location")}</span>
                  {request.location ? (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {request.location}
                    </p>
                  ) : null}
                  {request.mapX !== null && request.mapY !== null ? (
                    <div className="flex flex-col gap-1">
                      <TerraNovaMap
                        point={{ mapX: request.mapX, mapY: request.mapY }}
                        className="h-32 w-full max-w-sm rounded-xl bg-[#a9d3e0] dark:bg-[#16303a]"
                        ariaLabel={t("tn.request.location")}
                      />
                      <span className="text-[0.75rem] text-muted-foreground">{t("tn.request.map_point", { x: request.mapX, y: request.mapY })}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="conversation">
            <h2 id="conversation" className="px-1 font-semibold">{t("tn.request.conversation")}</h2>
            {agent ? null : <ContextTip id="request">{t("tn.tip.request")}</ContextTip>}
            {request.messages.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.request.no_reply")}</p>
            ) : (
              <ol className="flex flex-col gap-3" aria-live="polite" aria-relevant="additions" aria-label={t("tn.request.conversation")}>
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
                    <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[0.7812rem] text-muted-foreground">
                      <span className="font-semibold text-foreground">{message.author.name}</span>
                      {message.internal ? (
                        <Badge variant="warning">
                          <Lock className="size-3" aria-hidden />
                          {t("tn.request.internal_badge")}
                        </Badge>
                      ) : null}
                      <time dateTime={message.createdAt}>{fmt.dateTime(message.createdAt)}</time>
                    </p>
                    <p className="whitespace-pre-line break-words text-[0.9062rem] [overflow-wrap:anywhere]">{message.body}</p>
                  </li>
                ))}
              </ol>
            )}
            {closed ? (
              <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground">{t("tn.request.closed")}</p>
            ) : (
              <div id="reply" className="scroll-mt-24">
                <RequestComposer reference={request.reference} allowInternal={agent} onSent={setRequest} />
              </div>
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
