/**
 * F39 — agents open bookable slots; residents see the free ones. An agent can
 * never hold two slots that overlap, so one agent is never booked twice for
 * the same moment.
 */

import { isAdmin, isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AuthUser } from "@/types";

import type { AgentSlotDto, FreeSlotDto } from "./appointments.dto";
import type { OpenSlotsInput } from "./appointments.schema";
import { MAX_DAYS_AHEAD, MAX_SLOTS_PER_OPENING, MIN_BOOKING_NOTICE_MS, durationMinutes, generateSlots, type SlotDuration } from "./appointments.time";

const DAY_MS = 24 * 60 * 60_000;

function assertStaff(actor: AuthUser): void {
  if (!isStaff(actor)) throw new ForbiddenError("Only city agents can open appointment slots.");
}

export async function openSlots(input: OpenSlotsInput, actor: AuthUser, now: Date = new Date()): Promise<{ created: number; skipped: number }> {
  assertStaff(actor);
  const windows = generateSlots(input.date, input.from, input.to, input.duration as SlotDuration);
  if (windows.length === 0) throw new BadRequestError("This time range is too short for one slot.");
  if (windows.length > MAX_SLOTS_PER_OPENING) throw new BadRequestError("Open at most 48 slots at once.");
  const first = windows[0]!;
  const last = windows[windows.length - 1]!;
  if (first.startsAt.getTime() < now.getTime()) throw new BadRequestError("Slots must start in the future.");
  if (last.endsAt.getTime() > now.getTime() + MAX_DAYS_AHEAD * DAY_MS) throw new BadRequestError("Slots can be opened at most 90 days ahead.");

  let serviceId: string | null = null;
  if (input.serviceSlug) {
    const service = await prisma.municipalService.findUnique({ where: { slug: input.serviceSlug }, select: { id: true, active: true } });
    if (!service?.active) throw new BadRequestError("Choose an open service.");
    serviceId = service.id;
  }

  // Existing slots of this agent in the range: anything overlapping is kept as is.
  const existing = await prisma.agentSlot.findMany({
    where: { agentId: actor.id, startsAt: { lt: last.endsAt }, endsAt: { gt: first.startsAt } },
    select: { startsAt: true, endsAt: true },
  });
  const free = windows.filter((window) => !existing.some((slot) => slot.startsAt < window.endsAt && slot.endsAt > window.startsAt));
  if (free.length > 0) {
    await prisma.agentSlot.createMany({
      data: free.map((window) => ({ agentId: actor.id, serviceId, startsAt: window.startsAt, endsAt: window.endsAt, mode: input.mode, location: input.location })),
      skipDuplicates: true,
    });
  }
  return { created: free.length, skipped: windows.length - free.length };
}

/** The agent's own slots from today on, with the booking on each. */
export async function listMySlots(actor: AuthUser, now: Date = new Date()): Promise<AgentSlotDto[]> {
  assertStaff(actor);
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.agentSlot.findMany({
    where: { agentId: actor.id, startsAt: { gte: startOfDay } },
    orderBy: { startsAt: "asc" },
    take: 300,
    include: {
      service: { select: { slug: true, name: true } },
      appointment: { select: { reference: true, citizen: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    mode: row.mode,
    location: row.location,
    service: row.service,
    booking: row.appointment ? { reference: row.appointment.reference, citizenName: row.appointment.citizen.name } : null,
  }));
}

/** Withdraw a slot nobody booked; a booked one must be cancelled instead. */
export async function deleteSlot(id: string, actor: AuthUser): Promise<void> {
  assertStaff(actor);
  const slot = await prisma.agentSlot.findUnique({ where: { id }, select: { agentId: true, appointment: { select: { id: true } } } });
  if (!slot || (slot.agentId !== actor.id && !isAdmin(actor))) throw new NotFoundError("This slot does not exist.");
  if (slot.appointment) throw new ConflictError("This slot is booked. Cancel the appointment instead, so the resident is told.");
  await prisma.agentSlot.delete({ where: { id } });
}

/**
 * Free slots a resident can book, soonest first. With a service, its own
 * slots and the general ones (any subject) are offered.
 */
export async function listFreeSlots(query: { service?: string | undefined }, now: Date = new Date()): Promise<FreeSlotDto[]> {
  let serviceFilter = {};
  if (query.service) {
    const service = await prisma.municipalService.findUnique({ where: { slug: query.service }, select: { id: true } });
    serviceFilter = { OR: [{ serviceId: service?.id ?? "__none__" }, { serviceId: null }] };
  }
  const rows = await prisma.agentSlot.findMany({
    where: {
      startsAt: { gte: new Date(now.getTime() + MIN_BOOKING_NOTICE_MS) },
      appointment: { is: null },
      agent: { banned: false },
      ...serviceFilter,
    },
    orderBy: { startsAt: "asc" },
    take: 300,
    include: { service: { select: { slug: true, name: true } }, agent: { select: { name: true, firstName: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    durationMinutes: durationMinutes(row.startsAt, row.endsAt),
    mode: row.mode,
    location: row.location,
    service: row.service,
    agentName: row.agent.firstName ?? row.agent.name.split(" ")[0] ?? row.agent.name,
  }));
}
