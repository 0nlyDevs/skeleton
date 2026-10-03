/**
 * F38 demo data: one incident running now and one maintenance announced for
 * later, so the resident and agent views show something on a fresh database.
 * Dates are relative to the seeding time. A service is only touched while it
 * is marked available, so an interruption set by staff is never overwritten.
 */

import type { prisma as Prisma } from "../src/lib/db/prisma";

type Client = typeof Prisma;

const HOUR = 3_600_000;

export async function seedServiceAvailability(prisma: Client): Promise<void> {
  const now = Date.now();
  const civilProtection = await prisma.municipalService.findUnique({ where: { slug: "securite" }, select: { id: true } });

  await prisma.municipalService.updateMany({
    where: { slug: "eau-oxygene", availability: "AVAILABLE" },
    data: {
      availability: "INCIDENT",
      availabilityNote:
        "Une fuite à la station de recyclage du Verdant Basin ralentit le traitement des demandes d'eau et d'oxygène. Sans eau ou sans oxygène chez vous, appelez la protection civile.",
      unavailableFrom: new Date(now - HOUR),
      availableAgainAt: new Date(now + 3 * HOUR),
      alternativeServiceId: civilProtection?.id ?? null,
    },
  });

  // In two days, 08:00 to 14:00 UTC: the solar grid cut already announced in the news.
  const start = new Date(now + 2 * 24 * HOUR);
  start.setUTCHours(8, 0, 0, 0);
  await prisma.municipalService.updateMany({
    where: { slug: "energie", availability: "AVAILABLE" },
    data: {
      availability: "MAINTENANCE",
      availabilityNote:
        "Maintenance du réseau solaire du secteur est. Les demandes de raccordement et les signalements de panne déposés pendant les travaux seront traités à la reprise.",
      unavailableFrom: start,
      availableAgainAt: new Date(start.getTime() + 6 * HOUR),
    },
  });
}
