import { RateLimitedError } from "@/lib/errors";

import type {
  CounterState,
  RateLimitCheck,
  RateLimitResult,
  RateLimitRule,
  RateLimitStore,
} from "./types";

/**
 * The algorithms, with the store injected.
 *
 * Keeping this file free of globals and I/O means the tricky part — window
 * arithmetic and the "5 failures, 6th is 429" boundary — is directly unit
 * testable against `MemoryRateLimitStore`.
 */

export function toResult(
  state: CounterState,
  rule: RateLimitRule,
  now: Date,
): RateLimitResult {
  const remaining = Math.max(0, rule.limit - state.count);
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((state.resetAt.getTime() - now.getTime()) / 1000),
  );

  return {
    // Reaching the limit consumes every allowed attempt: the (limit + 1)-th
    // request inside the window is the one that gets rejected.
    allowed: state.count < rule.limit,
    limit: rule.limit,
    remaining,
    resetAt: state.resetAt,
    retryAfterSeconds,
  };
}

/** Inspect a counter without consuming an attempt. */
export async function peekLimit(
  store: RateLimitStore,
  check: RateLimitCheck,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const state = await store.peek(check.key, check.rule, now);
  return toResult(state, check.rule, now);
}

/** Consume one attempt and report the resulting state. */
export async function consume(
  store: RateLimitStore,
  check: RateLimitCheck,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const state = await store.increment(check.key, check.rule, now);
  return toResult(state, check.rule, now);
}

/**
 * Reject the request when the limit is already reached. Used before an attempt
 * whose failures we intend to count, so that successful requests never burn
 * budget.
 */
export async function assertAllowed(
  store: RateLimitStore,
  check: RateLimitCheck,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const result = await peekLimit(store, check, now);
  if (!result.allowed) {
    throw new RateLimitedError(result.retryAfterSeconds);
  }
  return result;
}

/**
 * Apply several limits at once — the classic "per IP **and** per account"
 * rule. Every counter is inspected, and the strictest remaining window decides
 * how long the client is told to wait.
 */
export async function assertAllAllowed(
  store: RateLimitStore,
  checks: readonly RateLimitCheck[],
  now: Date = new Date(),
): Promise<void> {
  let retryAfterSeconds = 0;

  for (const check of checks) {
    const result = await peekLimit(store, check, now);
    if (!result.allowed) {
      retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds);
    }
  }

  if (retryAfterSeconds > 0) {
    throw new RateLimitedError(retryAfterSeconds);
  }
}

/** Consume several counters in one go. */
export async function consumeAll(
  store: RateLimitStore,
  checks: readonly RateLimitCheck[],
  now: Date = new Date(),
): Promise<void> {
  await Promise.all(checks.map((check) => store.increment(check.key, check.rule, now)));
}

/** Clear counters, e.g. after a successful sign-in or password reset. */
export async function resetLimits(
  store: RateLimitStore,
  keys: readonly string[],
): Promise<void> {
  await Promise.all(keys.map((key) => store.clear(key)));
}
