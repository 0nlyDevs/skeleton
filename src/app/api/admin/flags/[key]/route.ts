import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

import { auditActions } from "@/modules/audit/audit.schema";
import { recordAudit } from "@/modules/audit/audit.service";

const flagKeyParamSchema = z.object({ key: z.string().trim().min(1).max(80) });
const updateFlagSchema = z.object({ enabled: z.boolean() });

/**
 * Feature flag toggle.
 *
 * Admin-only, audited, and upsert-based so a toggle on an unknown key creates the
 * row rather than 404ing — the flag list is seeded data, and the admin panel must
 * not depend on a migration running first.
 */
export const PATCH = apiRoute({
  roles: ADMIN_ROLES,
  params: flagKeyParamSchema,
  body: updateFlagSchema,
  handler: async ({ params, body, auth, ip }) => {
    const flag = await prisma.featureFlag.upsert({
      where: { key: params.key },
      create: { key: params.key, enabled: body.enabled },
      update: { enabled: body.enabled },
    });

    await recordAudit({
      actorId: auth.user.id,
      action: auditActions.featureFlagToggled,
      targetType: "feature_flag",
      targetId: flag.key,
      metadata: { enabled: flag.enabled },
      ip: ip ?? null,
    });

    return jsonOk({
      key: flag.key,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt.toISOString(),
    });
  },
});
