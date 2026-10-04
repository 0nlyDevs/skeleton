"use client";

import { ArrowRight, Footprints, Route, Siren } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { alternativesFor, findReplacementRoute, isInterrupted, strandedStops } from "@/modules/transports/replacement";
import type { TransportLineDto } from "@/modules/transports/transports.service";

function Code({ code }: { readonly code: string }) {
  return <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-foreground px-2 text-sm font-bold text-background">{code}</span>;
}

/**
 * F97 — for each interrupted line, what to take instead: the running lines
 * that serve the same stops, and the stops left without any line.
 */
export function InterruptedLines({ lines }: { readonly lines: readonly TransportLineDto[] }) {
  const t = useTranslation();
  const interrupted = lines.filter(isInterrupted);
  if (interrupted.length === 0) return null;
  return (
    <section aria-labelledby="replacement-title" className="flex flex-col gap-3 rounded-2xl border-2 border-warning/50 bg-warning/5 p-5">
      <div className="flex items-start gap-3">
        <Siren className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <h2 id="replacement-title" className="text-lg font-semibold">{t("tn.replacement.title", { count: interrupted.length })}</h2>
          <p className="text-sm text-muted-foreground">{t("tn.replacement.subtitle")}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {interrupted.map((line) => {
          const options = alternativesFor(line, lines);
          const stranded = strandedStops(line, lines);
          return (
            <li key={line.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                <Code code={line.code} />
                <span>{line.name}</span>
                <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[0.75rem] font-semibold">{t("tn.replacement.interrupted")}</span>
              </p>
              <p className="text-sm text-muted-foreground">{line.alert}</p>
              {options.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {options.map(({ line: other, shared }) => (
                    <li key={other.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <ArrowRight className="size-4 shrink-0" aria-hidden />
                      <span className="font-medium">{t("tn.replacement.take", { code: other.code, name: other.name })}</span>
                      <span className="text-muted-foreground">{t("tn.replacement.shared", { count: shared.length, stops: shared.slice(0, 4).join(", ") })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-medium">{t("tn.replacement.none")}</p>
              )}
              {stranded.length > 0 && options.length > 0 ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Footprints className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t("tn.replacement.stranded", { stops: stranded.join(", ") })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">{t("tn.replacement.ask_route")}</p>
    </section>
  );
}

/** F97 — the way from one stop to another using only the lines that run, with changes. */
export function ReplacementRoute({ lines, origin, destination }: { readonly lines: readonly TransportLineDto[]; readonly origin: string; readonly destination: string }) {
  const t = useTranslation();
  const route = findReplacementRoute(lines, origin, destination);
  if (!route) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed p-4 text-sm">
        <p className="font-medium">{t("tn.replacement.no_route")}</p>
        <p className="text-muted-foreground">
          {t("tn.replacement.no_route_help")}{" "}
          <Link href="/assistant" className="font-medium underline">{t("tn.replacement.ask_assistant")}</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-panel">
      <p className="flex items-center gap-2 font-semibold">
        <Route className="size-5" aria-hidden />
        {route.length === 1 ? t("tn.replacement.route_direct") : t("tn.replacement.route_changes", { count: route.length - 1 })}
      </p>
      <ol className="flex flex-col gap-2">
        {route.map((leg, index) => (
          <li key={`${leg.line.id}-${leg.from}`} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-muted text-[0.75rem] font-bold">{index + 1}</span>
            <Code code={leg.line.code} />
            <span>
              {t(index === 0 ? "tn.replacement.leg_first" : "tn.replacement.leg_change", { from: leg.from, to: leg.to, count: leg.stops.length - 1 })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
