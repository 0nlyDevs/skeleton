/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, and the custom server may be
 * restarted by PM2; without the global cache every reload would open a fresh
 * connection pool and exhaust MySQL's `max_connections` within minutes.
 */

import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Shared hosting enforces a hard per-account connection cap (cPanel/LVE), and a
 * Passenger worker is one process among several. A small, explicit pool is
 * safer than Prisma's default of `num_cpus * 2 + 1`.
 */
function withPoolDefaults(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "5");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "15");
    }
    return parsed.toString();
  } catch {
    // Leave a malformed URL untouched so Prisma reports the real problem.
    return url;
  }
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: withPoolDefaults(env.DATABASE_URL),
    log: env.databaseLogging
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "error" },
        ]
      : [{ emit: "stdout", level: "error" }],
  });

  if (env.databaseLogging) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).$on("query", (event: { duration: number; query: string }) => {
      logger.debug("sql", { durationMs: event.duration, query: event.query });
    });
  }

  return client;
}

const globalForPrisma = globalThis as typeof globalThis & {
  __webcupPrisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.__webcupPrisma ?? createPrismaClient();

if (!env.isProduction) {
  globalForPrisma.__webcupPrisma = prisma;
}

/** Cheap liveness probe for `/api/health`. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("database health check failed", { error });
    return false;
  }
}
