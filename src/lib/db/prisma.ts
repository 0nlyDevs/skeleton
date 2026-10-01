/**
 * Prisma client singleton.
 *
 * Prisma 7 has no Rust query engine: the client talks to MySQL through the
 * MariaDB driver (`@prisma/adapter-mariadb`). Two consequences worth knowing:
 *
 *   * **Pool settings come from the driver.** v6 read `connection_limit` from
 *     the URL; the adapter reads `connectionLimit` from its own options, so the
 *     URL is parsed once — in `pool-options.ts` — and translated explicitly
 *     rather than silently ignored. Pool size, timeouts and TLS all cross that
 *     same boundary.
 *   * **The Rust engine binary is gone.** The NixOS-specific engine paths that
 *     v6 deployments needed no longer apply.
 *
 * The instance is cached on `globalThis` because Next.js hot-reloads modules in
 * development and PM2 may restart a worker; without the cache every reload opens
 * another pool and MySQL's `max_connections` runs out within minutes.
 */

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

import { describePoolOptions, toPoolOptions } from "@/lib/db/pool-options";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Flatten an error and everything it wraps, outermost first.
 *
 * The reason a connection failed — `ER_CANNOT_RETRIEVE_RSA_KEY`, a self-signed
 * chain, `failed to create socket after 1003ms` — is chained under the pool's
 * generic complaint, and no printer here shows it: `logger` walks `cause` but not
 * Prisma's `meta`, where the driver adapter parks its own error. The deepest
 * entry is the diagnosis.
 */
function errorChain(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();

  const visit = (candidate: unknown, depth: number): void => {
    if (candidate === null || candidate === undefined || depth > 5 || seen.has(candidate)) return;
    seen.add(candidate);

    if (candidate instanceof Error) {
      messages.push(`${candidate.name}: ${candidate.message}`);
      visit(candidate.cause, depth + 1);
      return;
    }

    // Prisma's own errors carry the adapter failure in `meta` rather than `cause`.
    const meta = (candidate as { meta?: unknown }).meta;
    if (meta) {
      visit(meta, depth + 1);
      visit((meta as { driverAdapterError?: unknown }).driverAdapterError, depth + 1);
    }
  };

  visit(error, 0);
  return messages;
}

function createPrismaClient(): PrismaClient {
  const options = toPoolOptions(env.DATABASE_URL);

  if (env.databaseLogging) {
    logger.debug("prisma pool configured", describePoolOptions(options));
  }

  const client = new PrismaClient({
    adapter: new PrismaMariaDb(options),
    log: env.databaseLogging
      ? [
          { emit: "event", level: "query" },
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : [
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ],
  });

  if (env.databaseLogging) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).$on("query", (event: { duration: number; query: string }) => {
      logger.debug("sql", { durationMs: event.duration, query: event.query });
    });
  }

  // Routed through the logger in every build: a warning that only exists when
  // `DATABASE_LOG=1` is a warning nobody reads. The event carries no `error`, so
  // there is no chain to unwrap here.
  const listeners = client as unknown as {
    $on(
      level: "warn" | "error",
      handler: (event: { message: string; target: string }) => void,
    ): unknown;
  };

  listeners.$on("warn", (event) => {
    logger.warn("prisma warning", { target: event.target, message: event.message });
  });

  listeners.$on("error", (event) => {
    logger.error("prisma query failed", { target: event.target, message: event.message });
  });

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
    // `active=0 idle=0` means nothing ever connected; log the cause and the pool
    // settings that produced it.
    logger.error("database health check failed", {
      error,
      chain: errorChain(error),
      pool: describePoolOptions(toPoolOptions(env.DATABASE_URL)),
    });
    return false;
  }
}
