/**
 * F39/F40 — both people hear about every change to an appointment, with the
 * slot spelled out in full (day, date, times, time zone) so a notification
 * read on its own is never ambiguous.
 */

import { logger } from "@/lib/logger";

import { createNotification } from "../notifications/notifications.service";
import type { AppointmentRow } from "./appointments.dto";
import { formatSlot } from "./appointments.time";

function where(row: AppointmentRow): string {
  return row.mode === "PHONE" ? "par téléphone" : row.location ? `à ${row.location}` : "au guichet";
}

const citizenLink = (row: AppointmentRow) => `/appointments/${row.reference}`;
const agentLink = (row: AppointmentRow) => `/agent/appointments/${row.reference}`;

function settle(task: Promise<unknown>, reference: string, what: string): void {
  void task.catch((error: unknown) => logger.warn("appointment notification failed", { reference, what, error }));
}

export function notifyBooked(row: AppointmentRow): void {
  const slot = formatSlot(row.startsAt, row.endsAt);
  const service = row.service ? ` (${row.service.name})` : "";
  settle(
    createNotification({
      userId: row.citizenId,
      type: "APPOINTMENT",
      title: `Rendez-vous confirmé : ${row.reference}`,
      body: `${slot}, ${where(row)}, avec ${row.agent.firstName ?? row.agent.name}${service}. Préparez-le depuis la page du rendez-vous.`,
      link: citizenLink(row),
      email: true,
    }),
    row.reference,
    "booked:citizen",
  );
  settle(
    createNotification({
      userId: row.agentId,
      type: "APPOINTMENT",
      title: `Nouveau rendez-vous : ${row.citizen.name}`,
      body: `${slot}, ${where(row)}${service}. Référence ${row.reference}.`,
      link: agentLink(row),
      email: true,
    }),
    row.reference,
    "booked:agent",
  );
}

export function notifyCancelled(row: AppointmentRow, byCitizen: boolean, reason: string | null): void {
  const slot = formatSlot(row.startsAt, row.endsAt);
  const why = reason ? ` Motif : ${reason}` : "";
  settle(
    createNotification({
      userId: byCitizen ? row.agentId : row.citizenId,
      type: "APPOINTMENT",
      title: `Rendez-vous annulé : ${row.reference}`,
      body: byCitizen
        ? `${row.citizen.name} a annulé le rendez-vous du ${slot}.${why} Le créneau est de nouveau libre.`
        : `Votre rendez-vous du ${slot} a été annulé par l'agent.${why} Vous pouvez en reprendre un autre.`,
      link: byCitizen ? agentLink(row) : "/appointments/new",
      email: true,
    }),
    row.reference,
    "cancelled",
  );
}

/** F40 — the reminder the resident asked for; the agent gets the one-hour one too. */
export function notifyReminder(row: AppointmentRow, kind: "day" | "hour"): void {
  const slot = formatSlot(row.startsAt, row.endsAt);
  settle(
    createNotification({
      userId: row.citizenId,
      type: "APPOINTMENT",
      title: kind === "day" ? `Rappel : rendez-vous demain (${row.reference})` : `Rappel : rendez-vous dans une heure (${row.reference})`,
      body: `${slot}, ${where(row)}. Pensez à votre référence et à votre carte de résident. Un empêchement ? Annulez depuis la page du rendez-vous pour libérer le créneau.`,
      link: citizenLink(row),
      email: true,
    }),
    row.reference,
    `reminder:${kind}`,
  );
  if (kind === "hour") {
    settle(
      createNotification({ userId: row.agentId, type: "APPOINTMENT", title: `Rendez-vous dans une heure : ${row.citizen.name}`, body: `${slot}, ${where(row)}.`, link: agentLink(row) }),
      row.reference,
      "reminder:agent",
    );
  }
}
