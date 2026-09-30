/**
 * Prisma client singleton.
 *
 * Prisma 7 has no Rust query engine: the client talks to MySQL through the
 * MariaDB driver (`@prisma/adapter-mariadb`). Two consequences worth knowing:
 *
 *   * **Pool settings come from the driver.** v6 read `connection_limit` from
 *     the URL; the adapter reads `connectionLimit` from its own options, so the
 *     URL is parsed once here and translated explicitly rather than silently
 *     ignored.
 *   * **The Rust engine binary is gone.** The NixOS-specific engine paths that
 *     v6 deployments needed no longer apply.
 *
 * The instance is cached on `globalThis` because Next.js hot-reloads modules in
 * development and PM2 may restart a worker; without the cache every reload opens
 * another pool and MySQL's `max_connections` runs out within minutes.
 */

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Shared hosting enforces a hard per-account connection cap (cPanel/LVE). */
const DEFAULT_CONNECTION_LIMIT = 5;
const DEFAULT_POOL_TIMEOUT_SECONDS = 15;

interface MariaDbPoolOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  database?: string;
  connectionLimit: number;
  acquireTimeout: number;
  /** Set only when the server requires TLS; the driver defaults to plain TCP. */
  ssl?: { rejectUnauthorized: boolean };
}

/**
 * Translate a `mysql://user:pass@host:port/db?…` URL into driver options.
 *
 * Recognised query parameters:
 *   * `connection_limit` → `connectionLimit` (v6 name kept so existing
 *     deployments and `.env` files keep working unchanged)
 *   * `pool_timeout`     → `acquireTimeout` (seconds)
 *   * `sslaccept` / `ssl` → TLS
 *
 * Anything else is ignored rather than forwarded: the driver would reject
 * unknown options, and a URL that fails to parse should surface as Prisma's own
 * connection error, not as a crash inside this function.
 */
function toPoolOptions(url: string): MariaDbPoolOptions {
  const fallback: MariaDbPoolOptions = {
    host: "localhost",
    port: 3306,
    connectionLimit: DEFAULT_CONNECTION_LIMIT,
    acquireTimeout: DEFAULT_POOL_TIMEOUT_SECONDS * 1000,
  };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    logger.warn("DATABASE_URL could not be parsed; using driver defaults", { url });
    return fallback;
  }

  const connectionLimit = Number(parsed.searchParams.get("connection_limit"));
  const poolTimeout = Number(parsed.searchParams.get("pool_timeout"));
  const sslAccept = parsed.searchParams.get("sslaccept") ?? parsed.searchParams.get("ssl");

  return {
    host: parsed.hostname || fallback.host,
    port: parsed.port ? Number(parsed.port) : fallback.port,
    ...(parsed.username ? { user: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.pathname.length > 1 ? { database: decodeURIComponent(parsed.pathname.slice(1)) } : {}),
    connectionLimit:
      Number.isFinite(connectionLimit) && connectionLimit > 0
        ? connectionLimit
        : DEFAULT_CONNECTION_LIMIT,
    acquireTimeout:
      Number.isFinite(poolTimeout) && poolTimeout > 0
        ? poolTimeout * 1000
        : DEFAULT_POOL_TIMEOUT_SECONDS * 1000,
    ...(sslAccept && /require|strict/i.test(sslAccept)
      ? { ssl: { rejectUnauthorized: sslAccept !== "accept" } }
      : {}),
  };
}

function createPrismaClient(): PrismaClient {
  const options = toPoolOptions(env.DATABASE_URL);

  if (env.databaseLogging) {
    logger.debug("prisma pool configured", {
      host: options.host,
      port: options.port,
      database: options.database,
      connectionLimit: options.connectionLimit,
    });
  }

  const client = new PrismaClient({
    adapter: new PrismaMariaDb(options),
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
