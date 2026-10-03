/**
 * F39 — one clock for every appointment. Terra Nova keeps a single civil
 * time (UTC); every slot is shown with that time zone named, the same way on
 * the server, in emails and in the browser, so "10:00" never means two
 * different moments for the resident and the agent.
 */

export const CITY_TIME_ZONE = "UTC";

export const SLOT_DURATIONS = [15, 20, 30, 45, 60] as const;
export type SlotDuration = (typeof SLOT_DURATIONS)[number];

/** How far ahead an agent may open slots, and how many at once. */
export const MAX_DAYS_AHEAD = 90;
export const MAX_SLOTS_PER_OPENING = 48;
/** A resident cannot book a slot starting sooner than this. */
export const MIN_BOOKING_NOTICE_MS = 30 * 60_000;

const MINUTE = 60_000;

function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export interface SlotWindow {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/**
 * Cut `from`–`to` on `date` (city time) into consecutive slots of `duration`
 * minutes. A last piece shorter than the duration is dropped, never offered.
 */
export function generateSlots(date: string, from: string, to: string, duration: SlotDuration): SlotWindow[] {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const start = parseClock(from);
  const end = parseClock(to);
  if (!day || start === null || end === null || end <= start) return [];
  const midnight = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  const slots: SlotWindow[] = [];
  for (let minute = start; minute + duration <= end; minute += duration) {
    slots.push({ startsAt: new Date(midnight + minute * MINUTE), endsAt: new Date(midnight + (minute + duration) * MINUTE) });
  }
  return slots;
}

/** "mardi 7 octobre 2026, 10:00–10:30 (heure de Terra Nova)". */
export function formatSlot(startsAt: Date | string, endsAt: Date | string, locale: "fr" | "en" = "fr"): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const day = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: CITY_TIME_ZONE }).format(start);
  const clock = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: CITY_TIME_ZONE });
  const zone = locale === "fr" ? "heure de Terra Nova" : "Terra Nova time";
  return `${day}, ${clock.format(start)}–${clock.format(end)} (${zone})`;
}

/** Minutes between two instants, for "30 min". */
export function durationMinutes(startsAt: Date | string, endsAt: Date | string): number {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / MINUTE);
}

/** The city-time day key of an instant, for grouping slots by day. */
export function cityDay(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}
