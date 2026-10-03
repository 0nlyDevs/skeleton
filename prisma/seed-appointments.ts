/**
 * F39 demo data: two agents open slots over the next five working days (one
 * at the civil registry desk, one by phone), and the sample resident already
 * has one appointment booked, with its conversation.
 *
 * Idempotent: an agent who already has future slots gets none added, and the
 * sample appointment is created only if the resident has none.
 */

import { encryptField } from "../src/lib/crypto/field-encryption";
import type { prisma as Prisma } from "../src/lib/db/prisma";
import { generateSlots } from "../src/modules/appointments/appointments.time";
import { createGroupRoom } from "../src/modules/messages/messages.repository";

type Client = typeof Prisma;

const DESK = "Hôtel de ville de Nova Prime, guichet 2";

function nextWorkingDays(count: number): string[] {
  const days: string[] = [];
  const cursor = new Date();
  while (days.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

export async function seedAppointments(prisma: Client): Promise<void> {
  const [harena, tafita, citizen, registry] = await Promise.all([
    prisma.user.findUnique({ where: { email: "hei.harena.2@gmail.com" }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: "hei.tafita.2@gmail.com" }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: "colomberakotonjanahary@gmail.com" }, select: { id: true } }),
    prisma.municipalService.findUnique({ where: { slug: "etat-civil" }, select: { id: true } }),
  ]);
  if (!harena || !tafita || !citizen) return;
  const days = nextWorkingDays(5);
  const now = new Date();

  const plans = [
    { agentId: harena.id, from: "09:00", to: "12:00", duration: 30 as const, mode: "IN_PERSON" as const, location: DESK, serviceId: registry?.id ?? null },
    { agentId: tafita.id, from: "14:00", to: "16:00", duration: 20 as const, mode: "PHONE" as const, location: null, serviceId: null },
  ];
  for (const plan of plans) {
    if (await prisma.agentSlot.count({ where: { agentId: plan.agentId, startsAt: { gte: now } } })) continue;
    const data = days.flatMap((day) =>
      generateSlots(day, plan.from, plan.to, plan.duration).map((window) => ({
        agentId: plan.agentId,
        serviceId: plan.serviceId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        mode: plan.mode,
        location: plan.location,
      })),
    );
    await prisma.agentSlot.createMany({ data, skipDuplicates: true });
  }

  if (await prisma.appointment.count({ where: { citizenId: citizen.id } })) return;
  const slot = await prisma.agentSlot.findFirst({
    where: { agentId: harena.id, startsAt: { gte: new Date(now.getTime() + 36 * 3_600_000) }, appointment: { is: null } },
    orderBy: { startsAt: "asc" },
  });
  if (!slot) return;
  const appointment = await prisma.appointment.create({
    data: {
      reference: "RDV-204817",
      slotId: slot.id,
      citizenId: citizen.id,
      agentId: harena.id,
      serviceId: slot.serviceId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      mode: slot.mode,
      location: slot.location,
      reasonEncrypted: encryptField("Renouveler ma carte de résident : elle expire à la fin du mois."),
    },
  });
  const room = await createGroupRoom("RDV-204817 · État civil · rendez-vous au guichet", citizen.id, [harena.id]);
  await prisma.appointment.update({ where: { id: appointment.id }, data: { roomId: room.id } });
}
