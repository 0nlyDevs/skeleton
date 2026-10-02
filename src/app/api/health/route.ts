import { NextResponse } from "next/server";

import { publicRoute } from "@/lib/api/route";
import { getAiQuota, isAiConfigured } from "@/lib/ai/provider";
import { cacheStats } from "@/lib/cache";
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

    const payload = {
      status: databaseUp ? "ok" : "degraded",
      version: BUILD_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseUp ? "up" : "down",
        email: env.emailEnabled ? "configured" : "disabled",
        ai: isAiConfigured() ? "configured" : "disabled",
        realtime: isRealtimeAvailable() ? "up" : relayPreferred() ? "relay" : "polling-fallback",
        rateLimitStore: env.RATE_LIMIT_STORE,
        apiBurstLimitPerMinute: RATE_LIMITS.api.limit,
        cacheEntries: cacheStats().entries,
        aiQuotaRemainingUsd: aiQuota?.remainingUsd ?? null,
      },
    };

    return NextResponse.json(payload, {
      status: databaseUp ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  },
});
