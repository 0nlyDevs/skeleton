import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createNotification } from "@/modules/notifications/notifications.service";

import { zonesForAlertScope, type CityAlertScopeId } from "./city-zones";

const RECIPIENT_BATCH_SIZE = 300;

/** Persist and push an alert notification to residents inside its chosen scope. */
export async function notifyResidentsOfAlert(input: {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly scope: CityAlertScopeId;
}): Promise<void> {
  const targetZones = zonesForAlertScope(input.scope);
  const where = {
    banned: false,
    ...(input.scope === "ALL" ? {} : { cityZone: { in: [...targetZones] } }),
  };
  let afterId: string | undefined;
  let sent = 0;

  for (;;) {
    const users = await prisma.user.findMany({
      where: { ...where, ...(afterId ? { id: { gt: afterId } } : {}) },
      orderBy: { id: "asc" },
      take: RECIPIENT_BATCH_SIZE,
      select: { id: true },
    });
    if (users.length === 0) break;

    const results = await Promise.allSettled(users.map((user) =>
      createNotification({
        userId: user.id,
        type: "ALERT",
        // The alert's own words; the "city alert" label is translated per reader from the type.
        title: input.title.slice(0, 160),
        body: input.summary,
        link: `/alerts/${encodeURIComponent(input.slug)}`,
      }),
    ));
    sent += results.filter((result) => result.status === "fulfilled").length;
    const last = users.at(-1);
    if (!last || users.length < RECIPIENT_BATCH_SIZE) break;
    afterId = last.id;
  }

  logger.info("city alert notifications delivered", {
    slug: input.slug,
    scope: input.scope,
    recipientCount: sent,
  });
}
