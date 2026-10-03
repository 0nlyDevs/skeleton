import { prisma } from "@/lib/db/prisma";

import { createNotification } from "../notifications/notifications.service";

/**
 * Tell citizens about a new announcement (in-app). Alerts go to everyone;
 * other announcements too, capped so a huge user base cannot stall the call.
 */
export async function broadcastAnnouncement(slug: string, title: string, alert: boolean): Promise<void> {
  const users = await prisma.user.findMany({ where: { banned: false }, select: { id: true }, take: 2_000 });
  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "ANNOUNCEMENT",
      title: `${alert ? "Alerte" : "Annonce"} de la ville : ${title.slice(0, 120)}`,
      link: `/annonces/${encodeURIComponent(slug)}`,
    });
  }
}
