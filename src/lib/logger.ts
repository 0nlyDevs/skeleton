/**
 * Structured logger.
 *
 * Emits one JSON object per line in production so the HODi log file can be
 * tailed, grepped and shipped without a parser. In development it prints a
 * compact human-readable line. Secrets and personal data are redacted before
 * they reach the sink, which is the difference between a useful log and a
 * compliance incident.
 *
 * No dependency on pino/winston: this ships on shared hosting where every
 * kilobyte of `node_modules` costs inode quota and cold-start time.
 */

import { env } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Keys whose values are replaced before serialization. */
const REDACTED_KEY_PATTERN =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|otp|backup[-_]?code/i;

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 25;

export type LogMeta = Record<string, unknown>;

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  /** Returns a logger that merges `bindings` into every entry. */
  child(bindings: LogMeta): Logger;
}

function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: env.isProduction ? undefined : value.stack,
      ...(value.cause !== undefined ? { cause: redact(value.cause, depth + 1, seen) } : {}),
    };
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`…${value.length - MAX_ARRAY_ITEMS} more`);
    return items;
  }

  if (value instanceof Date) return value.toISOString();

  const output: LogMeta = {};
  for (const [key, entry] of Object.entries(value as LogMeta)) {
    output[key] = REDACTED_KEY_PATTERN.test(key) ? REDACTED : redact(entry, depth + 1, seen);
  }
  return output;
}

function currentLevel(): LogLevel {
  try {
    return env.LOG_LEVEL;
  } catch {
    // Never let logging take the app down: fall back to a safe default.
    return "info";
  }
}

function write(level: LogLevel, bindings: LogMeta, message: string, meta?: LogMeta): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel()]) return;

  const timestamp = new Date().toISOString();
  const payload = {
    level,
    time: timestamp,
    message,
    ...(redact(bindings) as LogMeta),
    ...(meta ? (redact(meta) as LogMeta) : {}),
  };

  const line = (() => {
    try {
      return env.isProduction
        ? JSON.stringify(payload)
        : `${level.toUpperCase().padEnd(5)} ${message} ${
            Object.keys(payload).length > 3
              ? JSON.stringify(
                  Object.fromEntries(
                    Object.entries(payload).filter(
                      ([key]) => !["level", "time", "message"].includes(key),
                    ),
                  ),
                )
              : ""
          }`.trimEnd();
    } catch {
      return `${level.toUpperCase()} ${message} [unserializable metadata]`;
    }
  })();

  const sink = level === "error" || level === "warn" ? console.error : console.warn;
  sink(line);
}

function buildLogger(bindings: LogMeta): Logger {
  return {
    debug: (message, meta) => write("debug", bindings, message, meta),
    info: (message, meta) => write("info", bindings, message, meta),
    warn: (message, meta) => write("warn", bindings, message, meta),
    error: (message, meta) => write("error", bindings, message, meta),
    child: (extra) => buildLogger({ ...bindings, ...extra }),
  };
}

/** Root logger. Prefer `logger.child({ requestId })` inside request scope. */
export const logger: Logger = buildLogger({ service: "webcup-base" });

/** Correlation id attached to every log line of a single request. */
export function newRequestId(): string {
  return crypto.randomUUID();
}
