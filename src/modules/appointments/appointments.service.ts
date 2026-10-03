/**
 * F39/F40 — appointments between a resident and an agent.
 *
 * Booking is safe against two people taking the same slot at once: the slot
 * reference on an appointment is unique in the database, so the second write
 * fails and that resident is asked to pick another slot. A resident also
 * cannot hold two appointments at the same moment. Both sides are notified,
 * get a conversation about the appointment, and can see exactly what to
 * prepare.
 */

import { randomInt } from "node:crypto";

import { isAdmin, isStaff } from "@/lib/auth/guards";
import { encryptField } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, ConflictError, NotFoundError, fromPrismaError } from "@/lib/errors";
import { grantRoomMembership } from "@/lib/socket/emit";
import { logger } from "@/lib/logger";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createGroupRoom } from "../messages/messages.repository";
import { appointmentInclude, toAppointmentDto, type AppointmentDto, type AppointmentRow } from "./appointments.dto";
import { notifyBooked, notifyCancelled } from "./appointments.notify";
import { basePreparation, tailoredPreparation, type PreparationAdvice } from "./appointments.preparation";
import type { BookAppointmentInput } from "./appointments.schema";
import { MIN_BOOKING_NOTICE_MS, formatSlot } from "./appointments.time";

async function newReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = `RDV-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
    if (!(await prisma.appointment.findUnique({ where: { reference }, select: { id: true } }))) return reference;
  }
  throw new Error("Could not allocate an appointment reference.");
}

/** The two participants and administrators; anyone else gets a 404. */
async function loadForParticipant(reference: string, actor: AuthUser): Promise<AppointmentRow> {
  const row = await prisma.appointment.findUnique({ where: { reference }, include: appointmentInclude });
  if (!row || (row.citizenId !== actor.id && row.agentId !== actor.id && !isAdmin(actor))) throw new NotFoundError("This appointment does not exist.");
  return row;
}

/** A conversation for the two of them, named after the appointment. */
async function openConversation(row: AppointmentRow): Promise<string | null> {
  try {
    const name = `${row.reference} · ${row.service?.name ?? "Rendez-vous"} · ${formatSlot(row.startsAt, row.endsAt)}`.slice(0, 190);
    const room = await createGroupRoom(name, row.citizenId, [row.agentId]);
    grantRoomMembership(row.citizenId, room.id);
    grantRoomMembership(row.agentId, room.id);
    await prisma.appointment.update({ where: { id: row.id }, data: { roomId: room.id } });
    return room.id;
  } catch (error) {
    logger.warn("appointment conversation could not be opened", { reference: row.reference, error });
    return null;
  }
}

export async function bookAppointment(input: BookAppointmentInput, actor: AuthUser, ip: string | null, now: Date = new Date()): Promise<AppointmentDto> {
  const slot = await prisma.agentSlot.findUnique({ where: { id: input.slotId }, include: { appointment: { select: { id: true } } } });
  if (!slot) throw new NotFoundError("This slot does not exist.");
  if (slot.appointment) throw new ConflictError("This slot was just taken. Choose another one.");
  if (slot.startsAt.getTime() < now.getTime() + MIN_BOOKING_NOTICE_MS) throw new BadRequestError("This slot is too soon to be booked. Choose a later one.");
  if (slot.agentId === actor.id) throw new BadRequestError("You cannot book your own slot.");

  const clash = await prisma.appointment.findFirst({
    where: { citizenId: actor.id, status: "BOOKED", startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } },
    select: { reference: true },
  });
  if (clash) throw new ConflictError("You already have an appointment at that time.");

  let row: AppointmentRow;
  try {
    row = await prisma.appointment.create({
      data: {
        reference: await newReference(),
        slotId: slot.id,
        citizenId: actor.id,
        agentId: slot.agentId,
        serviceId: slot.serviceId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        mode: slot.mode,
        location: slot.location,
        reasonEncrypted: encryptField(input.reason),
        remindDayBefore: input.remindDayBefore,
        remindHourBefore: input.remindHourBefore,
      },
      include: appointmentInclude,
    });
  } catch (error) {
    // Someone else's booking won the race for this slot.
    throw fromPrismaError(error, "This slot was just taken. Choose another one.") ?? error;
  }

  const roomId = await openConversation(row);
  await recordAudit({ actorId: actor.id, action: auditActions.appointmentChanged, targetType: "appointment", targetId: row.id, metadata: { op: "book", reference: row.reference }, ip });
  notifyBooked(row);
  return toAppointmentDto({ ...row, roomId }, isStaff(actor), now);
}

export async function cancelAppointment(reference: string, reason: string | null, actor: AuthUser, ip: string | null, now: Date = new Date()): Promise<AppointmentDto> {
  const row = await loadForParticipant(reference, actor);
  if (row.status !== "BOOKED" || row.startsAt.getTime() <= now.getTime()) throw new BadRequestError("Only an upcoming appointment can be cancelled.");
  const byCitizen = row.citizenId === actor.id;
  const slotId = row.slotId;

  const updated = await prisma.appointment.update({
    where: { id: row.id },
    // Clearing the slot frees it; when the agent cancels, the slot goes too.
    data: { status: "CANCELLED", slotId: null, cancelledAt: now, cancelledById: actor.id, cancelReason: reason },
    include: appointmentInclude,
  });
  if (!byCitizen && slotId) await prisma.agentSlot.delete({ where: { id: slotId } }).catch(() => undefined);

  await recordAudit({ actorId: actor.id, action: auditActions.appointmentChanged, targetType: "appointment", targetId: row.id, metadata: { op: "cancel", reference, by: byCitizen ? "citizen" : "agent" }, ip });
  notifyCancelled(updated, byCitizen, reason);
  return toAppointmentDto(updated, isStaff(actor), now);
}

/** The agent records whether the appointment took place. */
export async function setAppointmentOutcome(reference: string, status: "DONE" | "MISSED", actor: AuthUser, ip: string | null, now: Date = new Date()): Promise<AppointmentDto> {
  const row = await loadForParticipant(reference, actor);
  if (row.agentId !== actor.id && !isAdmin(actor)) throw new NotFoundError("This appointment does not exist.");
  if (row.status === "CANCELLED") throw new BadRequestError("This appointment was cancelled.");
  if (row.startsAt.getTime() > now.getTime()) throw new BadRequestError("An appointment can only be closed once it has started.");
  const updated = await prisma.appointment.update({ where: { id: row.id }, data: { status }, include: appointmentInclude });
  await recordAudit({ actorId: actor.id, action: auditActions.appointmentChanged, targetType: "appointment", targetId: row.id, metadata: { op: status === "DONE" ? "done" : "missed", reference }, ip });
  return toAppointmentDto(updated, true, now);
}

/** F40 — the resident chooses which reminders they want. */
export async function setReminderPreferences(reference: string, prefs: { remindDayBefore: boolean; remindHourBefore: boolean }, actor: AuthUser): Promise<AppointmentDto> {
  const row = await loadForParticipant(reference, actor);
  if (row.citizenId !== actor.id) throw new NotFoundError("This appointment does not exist.");
  const updated = await prisma.appointment.update({ where: { id: row.id }, data: prefs, include: appointmentInclude });
  return toAppointmentDto(updated, isStaff(actor));
}

export async function getAppointment(reference: string, actor: AuthUser): Promise<{ appointment: AppointmentDto; preparation: string[] }> {
  const row = await loadForParticipant(reference, actor);
  const appointment = toAppointmentDto(row, isStaff(actor));
  const preparation = basePreparation({
    reference: row.reference,
    mode: row.mode,
    location: row.location,
    serviceName: row.service?.name ?? null,
    serviceHowTo: row.service?.howTo ?? null,
    reason: appointment.reason,
  });
  return { appointment, preparation };
}

/** The resident's own appointments, upcoming first then the most recent past ones. */
export async function listMyAppointments(actor: AuthUser, now: Date = new Date()): Promise<AppointmentDto[]> {
  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({ where: { citizenId: actor.id, status: "BOOKED", startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 50, include: appointmentInclude }),
    prisma.appointment.findMany({ where: { citizenId: actor.id, OR: [{ status: { not: "BOOKED" } }, { startsAt: { lt: now } }] }, orderBy: { startsAt: "desc" }, take: 30, include: appointmentInclude }),
  ]);
  return [...upcoming, ...past].map((row) => toAppointmentDto(row, false, now));
}

/** The agent's appointments (an administrator sees everyone's), upcoming first. */
export async function listAgentAppointments(actor: AuthUser, now: Date = new Date()): Promise<AppointmentDto[]> {
  const scope = isAdmin(actor) ? {} : { agentId: actor.id };
  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({ where: { ...scope, status: "BOOKED", startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 100, include: appointmentInclude }),
    prisma.appointment.findMany({ where: { ...scope, OR: [{ status: { not: "BOOKED" } }, { startsAt: { lt: now } }] }, orderBy: { startsAt: "desc" }, take: 50, include: appointmentInclude }),
  ]);
  return [...upcoming, ...past].map((row) => toAppointmentDto(row, true, now));
}

/** Optional AI help to prepare; always falls back to the fixed checklist. */
export async function getPreparationAdvice(reference: string, actor: AuthUser, locale: "fr" | "en"): Promise<PreparationAdvice> {
  const row = await loadForParticipant(reference, actor);
  const appointment = toAppointmentDto(row, isStaff(actor));
  return tailoredPreparation(
    { reference: row.reference, mode: row.mode, location: row.location, serviceName: row.service?.name ?? null, serviceHowTo: row.service?.howTo ?? null, reason: appointment.reason },
    locale,
  );
}

/** Calendar file (RFC 5545) for the participant's own calendar app. */
export async function appointmentCalendar(reference: string, actor: AuthUser): Promise<string> {
  const row = await loadForParticipant(reference, actor);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/[,;]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");
  const summary = `Rendez-vous ${row.reference}${row.service ? ` · ${row.service.name}` : ""}`;
  const location = row.mode === "PHONE" ? "Par téléphone" : (row.location ?? "Mairie de Terra Nova");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Terra Nova//Rendez-vous//FR",
    "BEGIN:VEVENT",
    `UID:${row.reference}@terra-nova`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(row.startsAt)}`,
    `DTEND:${stamp(row.endsAt)}`,
    `SUMMARY:${escape(summary)}`,
    `LOCATION:${escape(location)}`,
    `DESCRIPTION:${escape(`Référence ${row.reference}. Avec ${row.agent.firstName ?? row.agent.name}.`)}`,
    row.status === "CANCELLED" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
