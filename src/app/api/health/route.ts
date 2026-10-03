import { NextResponse } from "next/server";

import { publicRoute } from "@/lib/api/route";
import { getAiQuota, isAiConfigured, isAiReachable } from "@/lib/ai/provider";
import { cacheStats } from "@/lib/cache";
import { encryptionHealth } from "@/lib/crypto/field-encryption";
import { isDatabaseReachable } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { relayPreferred } from "@/lib/socket/relay";
import { isRealtimeAvailable } from "@/lib/socket/registry";

const BUILD_VERSION = process.env.npm_package_version ?? "1.0.0";

/**
 * Liveness and readiness probe.
 *
 * Public, and deliberately terse: it reports *whether* a subsystem is up, never
 * its configuration, credentials or connection strings. Deploy tooling and the
 * uptime monitor are the audience; a jury is not supposed to learn the internal
 * topology from it.
 *
 * Returns 503 when the database is unreachable so a load balancer or PM2 health
 * check can act on it, and 200 otherwise.
 */
export const GET = publicRoute({
  skipBurstLimit: true,
  handler: async () => {
    const databaseUp = await isDatabaseReachable();
    const aiQuota = await getAiQuota();
    const encryption = encryptionHealth();

    const payload = {
      status: databaseUp ? "ok" : "degraded",
      version: BUILD_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseUp ? "up" : "down",
        email: env.emailEnabled ? "configured" : "disabled",
// "refused" distinguishes a missing key from a key the provider rejects:
        // the first is expected on a fresh deploy, the second is a live bug.
        ai: !isAiConfigured() ? "disabled" : isAiReachable() ? "configured" : "key-refused",
        realtime: isRealtimeAvailable() ? "up" : relayPreferred() ? "relay" : "polling-fallback",
        rateLimitStore: env.RATE_LIMIT_STORE,
        apiBurstLimitPerMinute: RATE_LIMITS.api.limit,
        cacheEntries: cacheStats().entries,
        aiQuotaRemainingUsd: aiQuota?.remainingUsd ?? null,
      },
      // Present only when it is wrong: values encrypted under a key this
      // process does not hold cannot be read, and the count is what turns a
      // silent data loss into a visible one.
      ...(encryption.healthy
        ? {}
        : {
            encryption: {
              failures: encryption.failures,
              lastFailureAt: encryption.lastFailureAt,
              keySource: encryption.keySource,
            },
          }),
    };

    return NextResponse.json(payload, {
      status: databaseUp ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  },
});
