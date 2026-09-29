import { z } from "zod";

import { publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { deleteAuditLogsOlderThan } from "@/modules/audit/audit.repository";
import { deleteReadNotificationsOlderThan } from "@/modules/notifications/notifications.repository";
import { getRateLimitStore } from "@/lib/rate-limit";
import { PrismaRateLimitStore } from "@/lib/rate-limit/prisma-store";

/**
 * Maintenance jobs, triggered from a cPanel cron entry:
 *
 *   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://host/api/cron/maintenance
 *
 * The endpoint is `public` at the routing layer because a cron job has no
 * session, and authenticated by a shared secret instead. The comparison is
 * constant-time-ish in intent: it requires an exact match on a value that never
 * appears in a URL, only in a header, so it stays out of access logs.
 *
 * In production a missing `CRON_SECRET` disables the endpoint entirely rather
 * than leaving it open — an unauthenticated maintenance trigger is a
 * denial-of-service primitive.
 */

const CRON_HEADER = "x-cron-secret";

const jobParamSchema = z.object({ job: z.enum(["maintenance"]) });

/** Retention windows. */
const AUDIT_RETENTION_DAYS = 90;
const NOTIFICATION_RETENTION_DAYS = 30;

export const POST = publicRoute({
  params: jobParamSchema,
  skipBurstLimit: true,
  handler: async ({ request, params }) => {
    const provided = request.headers.get(CRON_HEADER);
    const expected = env.CRON_SECRET;

    if (!expected) {
      if (env.isProduction) {
        throw new ForbiddenError("Scheduled jobs are disabled on this deployment.");
      }
      // Development convenience: allow a local run without a secret.
      logger.warn("cron job invoked without CRON_SECRET configured (development only)");
    } else if (!provided || provided !== expected) {
      logger.warn("cron job rejected: bad secret");
      throw new ForbiddenError("Invalid cron secret.");
    }

    if (params.job !== "maintenance") throw new NotFoundError("Unknown job.");

    const now = Date.now();

    const [auditRemoved, notificationsRemoved, rateLimitRemoved] = await Promise.all([
      deleteAuditLogsOlderThan(new Date(now - AUDIT_RETENTION_DAYS * 86_400_000)),
      deleteReadNotificationsOlderThan(
        new Date(now - NOTIFICATION_RETENTION_DAYS * 86_400_000),
      ),
      pruneRateLimitBuckets(),
    ]);

    logger.info("maintenance job completed", {
      auditRemoved,
      notificationsRemoved,
      rateLimitRemoved,
    });

    return jsonOk({
      job: params.job,
      removed: {
        auditLogs: auditRemoved,
        notifications: notificationsRemoved,
        rateLimitBuckets: rateLimitRemoved,
      },
      ranAt: new Date().toISOString(),
    });
  },
});

/** Only the durable store has rows to prune. */
async function pruneRateLimitBuckets(): Promise<number> {
  const store = getRateLimitStore();
  return store instanceof PrismaRateLimitStore ? store.pruneExpired() : 0;
}
