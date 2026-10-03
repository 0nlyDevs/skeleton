/**
 * F74 — weekly opening hours a machine can read, so the app says "open now,
 * closes at 17:00" or "closed, opens Monday at 08:30" instead of leaving the
 * resident to decode a sentence. Pure: shared by the API, the pages and tests.
 */

import { z } from "zod";

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

/** `HH:MM`, city time. A type alias (not an interface) so it is assignable to Prisma JSON input. */
export type DayHours = {
  readonly open: string;
  readonly close: string;
};

/** A missing or null day is a closed day. */
export type OpeningHours = { readonly [Day in WeekDay]?: DayHours | null };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const daySchema = z
  .object({
    open: z.string().regex(TIME, "Enter the time as HH:MM."),
    close: z.string().regex(TIME, "Enter the time as HH:MM."),
  })
  .strict()
  .refine((day) => day.open < day.close, { message: "Closing time must come after opening time.", path: ["close"] })
  .nullable()
  .optional();

export const openingHoursSchema = z
  .object({ mon: daySchema, tue: daySchema, wed: daySchema, thu: daySchema, fri: daySchema, sat: daySchema, sun: daySchema })
  .strict()
  .nullable()
  .optional();

/** Reads the stored JSON defensively: only known days with valid times survive. */
export function parseOpeningHours(value: unknown): OpeningHours | null {
  if (!value || typeof value !== "object") return null;
  const hours: Partial<Record<WeekDay, DayHours | null>> = {};
  let any = false;
  for (const day of WEEK_DAYS) {
    const raw = (value as Record<string, unknown>)[day];
    if (raw && typeof raw === "object") {
      const { open, close } = raw as { open?: unknown; close?: unknown };
      if (typeof open === "string" && typeof close === "string" && TIME.test(open) && TIME.test(close) && open < close) {
        hours[day] = { open, close };
        any = true;
        continue;
      }
    }
    hours[day] = null;
  }
  return any ? hours : null;
}

export interface OpenStateDto {
  readonly open: boolean;
  readonly today: WeekDay;
  /** Set while open: when today's opening ends. */
  readonly closesAt: string | null;
  /** Set while closed: the next opening, and how many days away it is (0 = later today). */
  readonly nextOpen: { readonly day: WeekDay; readonly time: string; readonly inDays: number } | null;
  /** Open around the clock, every day. */
  readonly always: boolean;
}

/** City time is UTC (see appointments.time.ts): the same clock for every resident. */
export function openStateAt(hours: OpeningHours, now: Date): OpenStateDto {
  const todayIndex = (now.getUTCDay() + 6) % 7;
  const today = WEEK_DAYS[todayIndex] as WeekDay;
  const clock = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const always = WEEK_DAYS.every((day) => hours[day]?.open === "00:00" && hours[day]?.close === "23:59");
  const range = hours[today] ?? null;
  if (range && clock >= range.open && clock < range.close) {
    return { open: true, today, closesAt: always ? null : range.close, nextOpen: null, always };
  }
  for (let offset = 0; offset < 8; offset += 1) {
    const day = WEEK_DAYS[(todayIndex + offset) % 7] as WeekDay;
    const next = hours[day];
    if (!next) continue;
    if (offset === 0 && clock >= next.open) continue;
    return { open: false, today, closesAt: null, nextOpen: { day, time: next.open, inDays: offset }, always: false };
  }
  return { open: false, today, closesAt: null, nextOpen: null, always: false };
}
