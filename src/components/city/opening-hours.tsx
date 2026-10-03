import type { MessageKey, Translator } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { WEEK_DAYS, type OpenStateDto, type OpeningHours } from "@/modules/city-services/opening-hours";

/** "08:30" → "8 h 30" in French, "8:30" in English. */
function clock(time: string, t: Translator): string {
  const [hours = "0", minutes = "00"] = time.split(":");
  return t("tn.hours.clock", { h: String(Number(hours)), m: minutes });
}

/** One sentence: open until when, or closed until when. */
export function openStateText(state: OpenStateDto, t: Translator): string {
  if (state.always) return t("tn.hours.always");
  if (state.open) return state.closesAt ? t("tn.hours.open_until", { time: clock(state.closesAt, t) }) : t("tn.hours.open");
  const next = state.nextOpen;
  if (!next) return t("tn.hours.closed");
  const time = clock(next.time, t);
  if (next.inDays === 0) return t("tn.hours.opens_today", { time });
  if (next.inDays === 1) return t("tn.hours.opens_tomorrow", { time });
  return t("tn.hours.opens_day", { day: t(`tn.hours.day.${next.day}` as MessageKey).toLowerCase(), time });
}

/**
 * F74 — "Ouvert · ferme à 17 h" at a glance. The state is said in words and
 * with a filled or empty bubble, never by colour alone.
 */
export function OpenStateLine({ state, t, className }: { readonly state: OpenStateDto; readonly t: Translator; readonly className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.8125rem]", state.open ? "font-medium text-success" : "text-muted-foreground", className)}>
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full border-[1.5px] border-current", state.open && "bg-current")} />
      {openStateText(state, t)}
    </span>
  );
}

/** The week, one line per day, today marked. */
export function WeekHours({ hours, today, t }: { readonly hours: OpeningHours; readonly today: OpenStateDto["today"]; readonly t: Translator }) {
  return (
    <dl className="flex flex-col text-sm">
      {WEEK_DAYS.map((day) => {
        const range = hours[day];
        const current = day === today;
        return (
          <div key={day} className={cn("flex items-baseline justify-between gap-3 rounded-lg px-2 py-1", current && "bg-surface-muted font-medium")}>
            <dt>
              {t(`tn.hours.day.${day}` as MessageKey)}
              {current ? <span className="sr-only"> ({t("tn.hours.today")})</span> : null}
            </dt>
            <dd className={cn("tabular-nums", !range && "text-muted-foreground")}>{range ? `${clock(range.open, t)} – ${clock(range.close, t)}` : t("tn.hours.closed")}</dd>
          </div>
        );
      })}
    </dl>
  );
}
