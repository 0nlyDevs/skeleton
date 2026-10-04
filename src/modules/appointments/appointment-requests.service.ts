/**
 * F39 (follow-up) — appointments on the resident's terms.
 *
 * Slots opened by agents are one way to meet; the other is to ask. A resident
 * proposes a day, a time and how long, with what it is about; every agent is
 * notified; one accepts (the appointment is created, with its conversation and
 * reminders, exactly as for a booked slot) or declines with a reason the
 * resident reads. The resident may withdraw a request that is still waiting.
 */

import { randomInt } from "node:crypto";

import { isStaff } from "@/lib/auth/guards";
import { decryptField, encryptField } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createGroupRoom } from "../messages/messages.repository";
import { createNotification, notifyInBackground } from "../notifications/notifications.service";
import { grantRoomMembership } from "@/lib/socket/emit";
import { appointmentInclude } from "./appointments.dto";
import { notifyBooked } from "./appointments.notify";
import type { AppointmentRequestInput, AppointmentRequestAcceptInput } from "./appointments.schema";
import { MAX_DAYS_AHEAD, MIN_BOOKING_NOTICE_MS, formatSlot } from "./appointments.time";

export interface AppointmentRequestDto {
  readonly reference: string;
  readonly status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  readonly preferredStart: string;
  readonly preferredEnd: string;
  readonly durationMinutes: number;
  readonly mode: "IN_PERSON" | "PHONE";
  readonly service: { readonly slug: string; readonly name: string } | null;
  readonly reason: string;
  /** Who asked; only sent to staff. */
  readonly citizen: { readonly id: string; readonly name: string } | null;
  readonly answer: string | null;
  readonly decidedAt: string | null;
  /** The appointment created on acceptance. */
  readonly appointmentRef: string | null;
  readonly createdAt: string;
}

const include = {
  service: { select: { slug: true, name: true } },
  citizen: { select: { id: true, name: true } },
} as const;
type Row = Awaited<ReturnType<typeof prisma.appointmentRequest.findFirstOrThrow<{ include: typeof include }>>>;

function toDto(row: Row, forStaff: boolean): AppointmentRequestDto {
  return {
    reference: row.reference,
    status: row.status,
    preferredStart: row.preferredStart.toISOString(),
    preferredEnd: new Date(row.preferredStart.getTime() + row.durationMinutes * 60_000).toISOString(),
    durationMinutes: row.durationMinutes,
    mode: row.mode,
    service: row.service,
    reason: decryptField(row.reasonEncrypted),
    citizen: forStaff ? row.citizen : null,
    answer: row.answer,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    appointmentRef: row.appointmentRef,
    createdAt: row.createdAt.toISOString(),
  };
}

async function staffIds(): Promise<string[]> {
  return (await prisma.user.findMany({ where: { role: { in: ["AGENT", "ADMIN"] }, banned: false }, select: { id: true }, take: 200 })).map((row) => row.id);
}

export async function createAppointmentRequest(input: AppointmentRequestInput, actor: AuthUser, ip: string | null, now: Date = new Date()): Promise<AppointmentRequestDto> {
  await enforceThenRecord([{ key: rateLimitKey("appointment-request:create", actor.id), rule: RATE_LIMITS.appointmentBook }]);
  const start = new Date(input.startsAt);
  if (start.getTime() < now.getTime() + MIN_BOOKING_NOTICE_MS) throw new BadRequestError("Choose a time at least half an hour from now.");
  if (start.getTime() > now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60_000) throw new BadRequestError("Appointments can be requested at most 90 days ahead.");

  let serviceId: string | null = null;
  if (input.serviceSlug) {
    const service = await prisma.municipalService.findFirst({ where: { slug: input.serviceSlug, active: true }, select: { id: true } });
    if (!service) throw new NotFoundError("This service does not exist.");
    serviceId = service.id;
  }
  const end = new Date(start.getTime() + input.duration * 60_000);
  const clash = await prisma.appointment.findFirst({ where: { citizenId: actor.id, status: "BOOKED", startsAt: { lt: end }, endsAt: { gt: start } }, select: { reference: true } });
  if (clash) throw new ConflictError("You already have an appointment at that time.");
  const waiting = await prisma.appointmentRequest.count({ where: { citizenId: actor.id, status: "PENDING" } });
  if (waiting >= 5) throw new ConflictError("You already have five requests waiting. Wait for an answer or withdraw one.");

  let reference = "";
  for (let attempt = 0; attempt < 10 && !reference; attempt += 1) {
    const candidate = `DEM-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
    if (!(await prisma.appointmentRequest.findUnique({ where: { reference: candidate }, select: { id: true } }))) reference = candidate;
  }
  if (!reference) throw new ConflictError("Could not allocate a request reference.");

  const row = await prisma.appointmentRequest.create({
    data: { reference, citizenId: actor.id, serviceId, preferredStart: start, durationMinutes: input.duration, mode: input.mode, reasonEncrypted: encryptField(input.reason) },
    include,
  });
  await recordAudit({ actorId: actor.id, action: auditActions.appointmentChanged, targetType: "appointment_request", targetId: row.id, metadata: { op: "request", reference: row.reference, title: row.reference }, ip });

  const slot = formatSlot(start, end);
  notifyInBackground(
    (async () => {
      await createNotification({ userId: actor.id, type: "APPOINTMENT", title: `Demande de rendez-vous ${row.reference} envoyée`, body: `${slot}. Un agent vous répond ici : vous serez prévenu·e.`, link: "/appointments#requests" });
      for (const id of await staffIds()) {
        if (id === actor.id) continue;
        await createNotification({ userId: id, type: "APPOINTMENT", title: `Demande de rendez-vous de ${row.citizen.name}`, body: `${slot}${row.service ? ` · ${row.service.name}` : ""}. À accepter ou refuser.`, link: "/agent/appointments#requests", email: true });
      }
    })(),
    { appointmentRequestId: row.id },
  );
  return toDto(row, false);
}

export async function listMyAppointmentRequests(actor: AuthUser): Promise<AppointmentRequestDto[]> {
  const rows = await prisma.appointmentRequest.findMany({ where: { citizenId: actor.id }, include, orderBy: { createdAt: "desc" }, take: 30 });
  return rows.map((row) => toDto(row, false));
}

export async function listPendingAppointmentRequests(actor: AuthUser): Promise<AppointmentRequestDto[]> {
  if (!isStaff(actor)) throw new NotFoundError("This request does not exist.");
  const rows = await prisma.appointmentRequest.findMany({ where: { status: "PENDING" }, include, orderBy: { preferredStart: "asc" }, take: 100 });
  return rows.map((row) => toDto(row, true));
}

async function loadPending(reference: string): Promise<Row> {
  const row = await prisma.appointmentRequest.findUnique({ where: { reference }, include });
  if (!row) throw new NotFoundError("This request does not exist.");
  if (row.status !== "PENDING") throw new ConflictError("This request was already answered.");
  return row;
}

export async function acceptAppointmentRequest(reference: string, input: AppointmentRequestAcceptInput, actor: AuthUser, ip: string | null, now: Date = new Date()): Promise<AppointmentRequestDto> {
  if (!isStaff(actor)) throw new NotFoundError("This request does not exist.");
  const request = await loadPending(reference);
  const start = input.startsAt ? new Date(input.startsAt) : request.preferredStart;
  if (start.getTime() < now.getTime()) throw new BadRequestError("This time has already passed. Propose another time.");
  const end = new Date(start.getTime() + request.durationMinutes * 60_000);
  if (request.mode === "IN_PERSON" && !input.location) throw new BadRequestError("Say where the resident should go.");

  const clash = await prisma.appointment.findFirst({
    where: { status: "BOOKED", startsAt: { lt: end }, endsAt: { gt: start }, OR: [{ citizenId: request.citizenId }, { agentId: actor.id }] },
    select: { reference: true },
  });
  if (clash) throw new ConflictError("You or the resident already have an appointment at that time.");

  // Claim the request first, in one atomic step: of two agents accepting at the same moment, only one wins.
  const claimed = await prisma.appointmentRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "ACCEPTED", decidedById: actor.id, decidedAt: now, answer: input.note ?? null } });
  if (claimed.count === 0) throw new ConflictError("This request was already answered.");

  let appointment: Awaited<ReturnType<typeof prisma.appointment.create<{ data: never; include: typeof appointmentInclude }>>>;
  let appointmentRef = "";
  try {
    for (let attempt = 0; attempt < 10 && !appointmentRef; attempt += 1) {
      const candidate = `RDV-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
      if (!(await prisma.appointment.findUnique({ where: { reference: candidate }, select: { id: true } }))) appointmentRef = candidate;
    }
    appointment = await prisma.appointment.create({
      data: {
        reference: appointmentRef,
        slotId: null,
        citizenId: request.citizenId,
        agentId: actor.id,
        serviceId: request.serviceId,
        startsAt: start,
        endsAt: end,
        mode: request.mode,
        location: request.mode === "PHONE" ? null : input.location,
        reasonEncrypted: request.reasonEncrypted,
      },
      include: appointmentInclude,
    });
  } catch (error) {
    // Nothing was created: put the request back in the queue.
    await prisma.appointmentRequest.updateMany({ where: { id: request.id, status: "ACCEPTED" }, data: { status: "PENDING", decidedById: null, decidedAt: null, answer: null } });
    throw error;
  }
  try {
    const name = `${appointment.reference} · ${appointment.service?.name ?? "Rendez-vous"} · ${formatSlot(start, end)}`.slice(0, 190);
    const room = await createGroupRoom(name, appointment.citizenId, [appointment.agentId]);
    grantRoomMembership(appointment.citizenId, room.id);
    grantRoomMembership(appointment.agentId, room.id);
    await prisma.appointment.update({ where: { id: appointment.id }, data: { roomId: room.id } });
  } catch {
    // The appointment stands without its conversation; both can still write from the message page.
  }
  const row = await prisma.appointmentRequest.update({ where: { id: request.id }, data: { appointmentRef }, include });
  await recordAudit({ actorId: actor.id, action: auditActions.appointmentChanged, targetType: "appointment_request", targetId: row.id, metadata: { op: "accept_request", reference: row.reference, title: row.reference }, ip });
  notifyBooked(appointment);
  return toDto(row, true);
}

export async function declineAppointmentRequest(reference: string, reason: string, actor: AuthUser, ip: string | null, now: Date = new Date()): Promise<AppointmentRequestDto> {
  if (!isStaff(actor)) throw new NotFoundError("This request does not exist.");
  const request = await loadPending(reference);
  const claimed = await prisma.appointmentRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "DECLINED", decidedById: actor.id, decidedAt: now, answer: reason } });
  if (claimed.count === 0) throw new ConflictError("This request was already answered.");
  const row = await prisma.appointmentRequest.findUniqueOrThrow({ where: { id: request.id }, include });
  await recordAudit({ actorId: actor.id, action: auditActions.appointmentChanged, targetType: "appointment_request", targetId: row.id, metadata: { op: "decline_request", reference: row.reference, title: row.reference }, ip });
  notifyInBackground(
    createNotification({
      userId: row.citizenId,
      type: "APPOINTMENT",
      title: `Demande de rendez-vous ${row.reference} refusée`,
      body: `${formatSlot(row.preferredStart, new Date(row.preferredStart.getTime() + row.durationMinutes * 60_000))}. Motif : ${reason} Vous pouvez choisir un autre moment ou un créneau déjà proposé.`,
      link: "/appointments/new",
      email: true,
    }),
    { appointmentRequestId: row.id },
  );
  return toDto(row, true);
}

export async function cancelAppointmentRequest(reference: string, actor: AuthUser, ip: string | null): Promise<AppointmentRequestDto> {
  const row = await prisma.appointmentRequest.findUnique({ where: { reference }, include });
  // Someone else's request reads as "does not exist".
  if (!row || row.citizenId !== actor.id) throw new NotFoundError("This request does not exist.");
  if (row.status !== "PENDING") throw new ConflictError("This request was already answered.");
  const claimed = await prisma.appointmentRequest.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (claimed.count === 0) throw new ConflictError("This request was already answered.");
  const updated = await prisma.appointmentRequest.findUniqueOrThrow({ where: { id: row.id }, include });
  await recordAudit({ actorId: actor.id, action: auditActions.appointmentChanged, targetType: "appointment_request", targetId: row.id, metadata: { op: "cancel_request", reference: row.reference, title: row.reference }, ip });
  return toDto(updated, false);
}
