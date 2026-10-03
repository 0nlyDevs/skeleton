import type { Translator } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STEPS = ["RECEIVED", "READ", "ANSWERED"] as const;

/**
 * F76 — what happened to a comment, as three steps: received, read by the
 * service, answered. A reached step is a filled bubble with its date; the
 * words carry the meaning, the bubble only repeats it.
 */
export function FeedbackTrail({
  status,
  dates,
  t,
}: {
  readonly status: (typeof STEPS)[number];
  readonly dates: { readonly received: string; readonly read: string | null; readonly answered: string | null };
  readonly t: Translator;
}) {
  const reached = STEPS.indexOf(status);
  const when = [dates.received, dates.read, dates.answered];
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t("tn.feedback.trail.label")}>
      {STEPS.map((step, index) => {
        const done = index <= reached;
        return (
          <li key={step} className={cn("flex items-center gap-2 text-[0.8125rem]", done ? "text-foreground" : "text-muted-foreground")}>
            <span aria-hidden className={cn("size-3 shrink-0 rounded-full border-[1.5px]", done ? "border-success bg-success" : "border-border")} />
            <span>
              <span className={cn(done && "font-medium")}>{t(`tn.feedback.trail.${step}`)}</span>
              <span className="sr-only">{done ? ` (${t("tn.feedback.trail.done")})` : ` (${t("tn.feedback.trail.pending")})`}</span>
              {done && when[index] ? <span className="block text-[0.75rem] text-muted-foreground">{when[index]}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
