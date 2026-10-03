/**
 * F40 — reminders before an appointment, the day before and an hour before,
 * as each resident chose. A minute-by-minute job in the server process finds
 * the ones due and claims each reminder with a conditional update, so two
 * server processes never send the same reminder twice.
 *
 * A reminder that would arrive right after booking is skipped: someone who
 * booked this morning for this afternoon needs no "tomorrow" reminder.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

import { appointmentInclude } from "./appointments.dto";
import { notifyReminder } from "./appointments.notify";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const TICK_MS = MINUTE;

/** A reminder is worth sending only if booked well before its own window. */
export function reminderIsUseful(kind: "day" | "hour", startsAt: Date, createdAt: Date): boolean {
  const lead = startsAt.getTime() - createdAt.getTime();
  return kind === "day" ? lead > 23 * HOUR : lead > 90 * MINUTE;
}

async function sendDue(kind: "day" | "hour", now: Date): Promise<number> {
  const windowEnd = new Date(now.getTime() + (kind === "day" ? 24 * HOUR : HOUR));
  const sentField = kind === "day" ? "dayReminderSentAt" : "hourReminderSentAt";
  const wantField = kind === "day" ? "remindDayBefore" : "remindHourBefore";
  const due = await prisma.appointment.findMany({
    where: {
      status: "BOOKED",
      [wantField]: true,
      [sentField]: null,
      // The day reminder stops where the hour reminder takes over.
      startsAt: { gt: kind === "day" ? new Date(now.getTime() + HOUR) : now, lte: windowEnd },
    },
    include: appointmentInclude,
    take: 200,
  });

  let sent = 0;
  for (const row of due) {
    const claimed = await prisma.appointment.updateMany({ where: { id: row.id, [sentField]: null }, data: { [sentField]: now } });
    if (claimed.count === 0) continue;
    if (!reminderIsUseful(kind, row.startsAt, row.createdAt)) continue;
    notifyReminder(row, kind);
    sent += 1;
  }
  return sent;
}

export async function sendDueReminders(now: Date = new Date()): Promise<{ day: number; hour: number }> {
  const day = await sendDue("day", now);
  const hour = await sendDue("hour", now);
  if (day + hour > 0) logger.info("appointment reminders sent", { day, hour });
  return { day, hour };
}

export function startAppointmentReminders(): () => void {
  const tick = () => {
    void sendDueReminders().catch((error: unknown) => logger.warn("appointment reminders failed", { error }));
  };
  const first = setTimeout(tick, 20_000);
  const timer = setInterval(tick, TICK_MS);
  first.unref?.();
  timer.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
