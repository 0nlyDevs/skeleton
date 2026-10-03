"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Switch } from "@/components/ui/switch";
import type { MessageKey } from "@/lib/i18n";
import { WEEK_DAYS, type DayHours, type WeekDay } from "@/modules/city-services/opening-hours";

export type HoursDraft = Record<WeekDay, DayHours | null>;

export function emptyHoursDraft(): HoursDraft {
  return { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
}

const TIME_CLASS =
  "h-9 w-[6.5rem] rounded-[var(--radius-control)] border border-input bg-surface px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50";

/** F74 — one row per day: open or closed, from when to when. */
export function OpeningHoursEditor({ value, onChange, error }: { readonly value: HoursDraft; readonly onChange: (next: HoursDraft) => void; readonly error?: string | undefined }) {
  const t = useTranslation();
  const set = (day: WeekDay, hours: DayHours | null) => onChange({ ...value, [day]: hours });

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-border/70 p-4">
      <legend className="px-1 text-sm font-medium">{t("tn.hours.editor.title")}</legend>
      <p className="text-[0.8125rem] text-muted-foreground">{t("tn.hours.editor.hint")}</p>
      <ul className="flex flex-col gap-2">
        {WEEK_DAYS.map((day) => {
          const hours = value[day];
          const label = t(`tn.hours.day.${day}` as MessageKey);
          return (
            <li key={day} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="flex w-36 items-center gap-2 text-sm">
                <Switch checked={hours !== null} onCheckedChange={(open) => set(day, open ? { open: "08:30", close: "17:00" } : null)} />
                {label}
              </label>
              {hours ? (
                <span className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    aria-label={t("tn.hours.editor.open_at", { day: label })}
                    value={hours.open}
                    onChange={(event) => set(day, { ...hours, open: event.target.value })}
                    className={TIME_CLASS}
                  />
                  <span aria-hidden>–</span>
                  <input
                    type="time"
                    aria-label={t("tn.hours.editor.close_at", { day: label })}
                    value={hours.close}
                    onChange={(event) => set(day, { ...hours, close: event.target.value })}
                    className={TIME_CLASS}
                  />
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">{t("tn.hours.closed")}</span>
              )}
            </li>
          );
        })}
      </ul>
      {error ? <p role="alert" className="text-[0.8125rem] text-error">{error}</p> : null}
    </fieldset>
  );
}
