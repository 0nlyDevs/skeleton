/**
 * `DATABASE_URL` → MariaDB driver options.
 *
 * The driver adapter never sees the URL, so every connection parameter a
 * deployment expresses in it is translated here.
 *
 * Getting this wrong is silent: the pool reports `pool failed to retrieve a
 * connection from pool (active=0 idle=0 limit=N)` after the acquire timeout,
 * which reads like exhaustion when in fact nothing ever connected. Two causes,
 * both handled here — TLS parameters dropped on the floor, and the driver's own
 * one-second `connectTimeout`, which a remote TLS handshake cannot beat.
 */

import { logger } from "@/lib/logger";

/** Shared hosting enforces a hard per-account connection cap (cPanel/LVE). */
export const DEFAULT_CONNECTION_LIMIT = 5;
export const DEFAULT_POOL_TIMEOUT_SECONDS = 15;
/** Same figure Prisma's own MySQL adapter uses. */
export const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;

export interface MariaDbPoolOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  database?: string;
  connectionLimit: number;
  /** Bounds the wait for a free connection, not the time to open one. */
  acquireTimeout: number;
  /** Bounds the TCP connect plus the TLS handshake. */
  connectTimeout: number;
  ssl?: { rejectUnauthorized: boolean; ca?: string };
}

/**
 * `encrypt` deliberately does not verify: that is MySQL's own meaning of
 * `ssl-mode=REQUIRED`, and the only mode that reaches a host which self-signs,
 * as most managed providers do.
 */
type TlsMode = "off" | "encrypt" | "verify";

const TLS_OFF_VALUES = ["", "0", "off", "no", "none", "disable", "disabled", "false"];
const TLS_ENCRYPT_VALUES = [
  "1",
  "on",
  "yes",
  "true",
  "accept",
  "prefer",
  "preferred",
  "require",
  "required",
  "strict",
];
const TLS_VERIFY_VALUES = ["verify_ca", "verify_identity", "verify_full"];

/**
 * Read TLS intent from the URL. Honours `ssl-mode`, the older Prisma `sslaccept`,
 * and `ssl`, because `.env` files outlive the version that documented them.
 *
 * Unset means plain TCP — right for a local or cPanel MySQL, wrong for every
 * managed host — so an unrecognised value warns rather than guesses.
 */
export function resolveTlsMode(params: URLSearchParams): TlsMode {
  const raw = params.get("ssl-mode") ?? params.get("sslaccept") ?? params.get("ssl");
  if (raw === null) return "off";

  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (TLS_OFF_VALUES.includes(value)) return "off";
  if (TLS_VERIFY_VALUES.includes(value)) return "verify";
  if (TLS_ENCRYPT_VALUES.includes(value)) return "encrypt";

  logger.warn("unrecognised TLS setting in DATABASE_URL; connecting unencrypted", { value: raw });
  return "off";
}

/**
 * Recognised parameters: `connection_limit`, `pool_timeout` and
 * `connect_timeout` (seconds), `ssl-mode`/`sslaccept`/`ssl`, and `ssl-ca` for
 * the verify modes. Others are ignored rather than forwarded: the driver rejects
 * unknown options, and a URL that fails to parse should surface as Prisma's own
 * connection error rather than a crash here.
 */
export function toPoolOptions(url: string): MariaDbPoolOptions {
  const fallback: MariaDbPoolOptions = {
    host: "localhost",
    port: 3306,
    connectionLimit: DEFAULT_CONNECTION_LIMIT,
    acquireTimeout: DEFAULT_POOL_TIMEOUT_SECONDS * 1000,
    connectTimeout: DEFAULT_CONNECT_TIMEOUT_SECONDS * 1000,
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
  const connectTimeout = Number(parsed.searchParams.get("connect_timeout"));
  const tlsMode = resolveTlsMode(parsed.searchParams);
  const ca = parsed.searchParams.get("ssl-ca")?.trim() || undefined;

  if (tlsMode === "verify" && !ca) {
    logger.warn(
      "DATABASE_URL requests certificate verification but sets no ssl-ca; a self-signed host will be rejected",
    );
  }

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
    connectTimeout:
      Number.isFinite(connectTimeout) && connectTimeout > 0
        ? connectTimeout * 1000
        : DEFAULT_CONNECT_TIMEOUT_SECONDS * 1000,
    ...(tlsMode === "off" ? {} : { ssl: { rejectUnauthorized: tlsMode === "verify", ...(ca ? { ca } : {}) } }),
  };
}

/** Pool summary for logs. Never includes credentials. */
export function describePoolOptions(options: MariaDbPoolOptions): Record<string, unknown> {
  return {
    host: options.host,
    port: options.port,
    database: options.database,
    connectionLimit: options.connectionLimit,
    acquireTimeout: options.acquireTimeout,
    connectTimeout: options.connectTimeout,
    tls: options.ssl ? (options.ssl.rejectUnauthorized ? "verify" : "encrypt") : "off",
    ...(options.ssl?.ca ? { ca: options.ssl.ca } : {}),
  };
}