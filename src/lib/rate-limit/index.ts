/**
 * Rate limiting, server entry point.
 *
 * Call sites only ever touch four functions — `enforceLimits`, `recordLimit`,
 * `inspectLimit`, `clearLimits` — so switching the backing store from memory to
 * MySQL (or Redis later) is a configuration change, not a refactor.
 */

import { env } from "@/lib/env";

import { assertAllAllowed, consume, peekLimit, resetLimits } from "./core";
import { MemoryRateLimitStore } from "./memory-store";
import { PrismaRateLimitStore } from "./prisma-store";
import type { RateLimitCheck, RateLimitResult, RateLimitStore } from "./types";

export { RATE_LIMITS, type RateLimitName } from "./rules";
export { rateLimitKey, accountAndIpKeys, hashIdentifier } from "./keys";
export type {
  CounterState,
  RateLimitCheck,
  RateLimitResult,
  RateLimitRule,
  RateLimitStore,
} from "./types";

let store: RateLimitStore | undefined;
let burstStore: RateLimitStore | undefined;

/**
 * The store is built on first use rather than at import time so that building
 * the app never depends on runtime configuration being present.
 */
export function getRateLimitStore(): RateLimitStore {
  if (!store) {
    store =
      env.RATE_LIMIT_STORE === "database"
        ? new PrismaRateLimitStore()
        : new MemoryRateLimitStore();
  }
  return store;
}

/**
 * Always process-local, always in-memory.
 *
 * Used for the generic per-request burst limit that every API route carries.
 * That check happens on every single request, so it must stay cheap: putting it
 * in MySQL would double the database load of the whole application. A durable
 * store is reserved for the low-volume, security-critical counters created by
 * `enforceLimits` — see `RATE_LIMIT_STORE`.
 */
export function getBurstLimitStore(): RateLimitStore {
  burstStore ??= new MemoryRateLimitStore();
  return burstStore;
}

/** Consume one unit of the process-local burst budget. */
export async function consumeBurstLimit(
  check: RateLimitCheck,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  return consume(getBurstLimitStore(), check, now);
}

/**
 * Reject the request when any of the supplied counters is exhausted.
 * Checks run in parallel; the longest remaining window wins the `Retry-After`.
 */
export async function enforceLimits(
  checks: readonly RateLimitCheck[],
  now: Date = new Date(),
): Promise<void> {
  await assertAllAllowed(getRateLimitStore(), checks, now);
}

/**
 * "Count every attempt, reject once the budget is gone."
 *
 * The check happens before the increment, so the request that trips the limit
 * is rejected without pushing the counter past the limit. This is the shape
 * used for authentication attempts, where a successful attempt clears the
 * counter (`clearLimits`) and therefore only failures accumulate.
 */
export async function enforceThenRecord(
  checks: readonly RateLimitCheck[],
  now: Date = new Date(),
): Promise<void> {
  const store = getRateLimitStore();
  await assertAllAllowed(store, checks, now);
  await Promise.all(checks.map((check) => store.increment(check.key, check.rule, now)));
}

/** Record one attempt against a counter (call it when the attempt fails). */
export async function recordLimit(
  check: RateLimitCheck,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  return consume(getRateLimitStore(), check, now);
}

/** Inspect a counter without consuming an attempt. */
export async function inspectLimit(
  check: RateLimitCheck,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  return peekLimit(getRateLimitStore(), check, now);
}

/** Forget counters, e.g. after a successful sign-in. */
export async function clearLimits(keys: readonly string[]): Promise<void> {
  await resetLimits(getRateLimitStore(), keys);
}
