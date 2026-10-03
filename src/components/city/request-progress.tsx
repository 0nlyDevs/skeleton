"use client";

import { Check } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Term } from "@/components/ui/term";
import type { GlossaryId } from "@/lib/glossary";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * D11 — where a request stands, as four steps a citizen can read at a glance:
 * received, taken on by an agent, being handled, resolved. A request waiting
 * on the citizen shows that on the third step instead of a bare status.
 */
function stepsFor(status: string, assigned: boolean): { keys: MessageKey[]; current: number } {
  const third: MessageKey = status === "WAITING_CITIZEN" ? "tn.progress.waiting" : "tn.progress.processing";
  const keys: MessageKey[] = ["tn.progress.received", "tn.progress.assigned", third, "tn.progress.resolved"];
  if (status === "RESOLVED" || status === "CLOSED") return { keys, current: 4 };
  if (status === "IN_PROGRESS" || status === "WAITING_CITIZEN") return { keys, current: 2 };
  return { keys, current: assigned ? 1 : 0 };
}

/** D13 — steps whose word may need explaining link to the glossary definition. */
const GLOSSARY_FOR_STEP: Partial<Record<MessageKey, GlossaryId>> = {
  "tn.progress.assigned": "taken_on",
  "tn.progress.waiting": "waiting",
  "tn.progress.resolved": "resolved",
};

export function RequestProgress({
  status,
  assigned,
  compact = false,
  className,
}: {
  readonly status: string;
  readonly assigned: boolean;
  readonly compact?: boolean;
  readonly className?: string;
}) {
  const t = useTranslation();
  const { keys, current } = stepsFor(status, assigned);
  const shown = Math.min(current + 1, keys.length);
  const summary = t("tn.progress.step", { current: shown, total: keys.length, label: t(keys[shown - 1] as MessageKey) });

  if (compact) {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <span className="flex gap-1" aria-hidden>
          {keys.map((key, index) => (
            <span
              key={key}
              className={cn(
                "h-1.5 w-6 rounded-full",
                index < current || current === keys.length ? "bg-success" : index === current ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </span>
        <span className="text-[0.75rem] text-muted-foreground">{summary}</span>
      </span>
    );
  }

  return (
    <ol aria-label={t("tn.progress.label")} className={cn("grid grid-cols-4 gap-1", className)}>
      {keys.map((key, index) => {
        const done = index < current || current === keys.length;
        const active = !done && index === current;
        const state = done ? t("tn.progress.done") : active ? t("tn.progress.current") : t("tn.progress.todo");
        return (
          <li key={key} aria-current={active ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", index === 0 ? "bg-transparent" : done || active ? "bg-primary" : "bg-border")} aria-hidden />
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border-2 text-[0.75rem] font-semibold",
                  done ? "border-success bg-success text-success-foreground" : active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className={cn("h-0.5 flex-1", index === keys.length - 1 ? "bg-transparent" : done ? "bg-primary" : "bg-border")} aria-hidden />
            </span>
            <span className={cn("text-[0.75rem] leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {GLOSSARY_FOR_STEP[key] ? <Term id={GLOSSARY_FOR_STEP[key]}>{t(key)}</Term> : t(key)}
              <span className="sr-only"> ({state})</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
