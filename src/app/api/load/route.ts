import { z } from "zod";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { FLAG_KEY, loadSnapshot, setForcedEssential } from "@/lib/load/monitor";
import { auditActions } from "@/modules/audit/audit.schema";
import { recordAudit } from "@/modules/audit/audit.service";

/**
 * F77 — everyone may know whether the platform is in essential mode (the
 * banner needs it); only staff get the figures.
 */
export const GET = publicRoute({
  skipBurstLimit: true,
  handler: ({ auth }) => {
    const snapshot = loadSnapshot();
    const staff = auth?.user.role === "ADMIN" || auth?.user.role === "AGENT";
    return jsonOk({ data: staff ? snapshot : { level: snapshot.level } });
  },
});

/** F77 — an administrator forces or releases essential mode. */
export const PUT = apiRoute({
  roles: ["ADMIN"],
  body: z.object({ forced: z.boolean() }).strict(),
  handler: async ({ body, auth, ip }) => {
    await prisma.featureFlag.upsert({
      where: { key: FLAG_KEY },
      create: { key: FLAG_KEY, enabled: body.forced, description: "Mode essentiel forcé : les parties non essentielles sont en pause." },
      update: { enabled: body.forced },
    });
    setForcedEssential(body.forced);
    await recordAudit({ actorId: auth.user.id, action: auditActions.featureFlagToggled, targetType: "feature_flag", targetId: FLAG_KEY, metadata: { enabled: body.forced }, ip });
    return jsonOk({ data: loadSnapshot() });
  },
});
