import type { CounterState, RateLimitRule, RateLimitStore } from "./types";

interface Bucket {
  count: number;
  /** Epoch milliseconds when the window ends. */
  resetAt: number;
}

export interface MemoryRateLimitStoreOptions {
  /**
   * Expired buckets are evicted opportunistically every N operations. The map
   * never grows beyond the number of keys seen within one window, so an
   * attacker cannot turn rate limiting into a memory-exhaustion vector.
   */
  readonly sweepEvery?: number;
}

/**
 * Process-local fixed-window counter.
 *
 * Fast and dependency-free, which makes it right for development, tests and
 * single-process deployments. It is **not** shared between processes: on a
 * Passenger host running several workers, use `PrismaRateLimitStore` so the
 * limit is enforced globally.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly #buckets = new Map<string, Bucket>();
  readonly #sweepEvery: number;
  #operations = 0;

  constructor(options: MemoryRateLimitStoreOptions = {}) {
    this.#sweepEvery = Math.max(1, options.sweepEvery ?? 500);
  }

  /** Number of live buckets; used by tests and metrics. */
  get size(): number {
    return this.#buckets.size;
  }

  async increment(key: string, rule: RateLimitRule, now: Date): Promise<CounterState> {
    this.#maybeSweep(now);
    const existing = this.#live(key, now);

    const bucket: Bucket = existing
      ? { count: existing.count + 1, resetAt: existing.resetAt }
      : { count: 1, resetAt: now.getTime() + rule.windowMs };

    this.#buckets.set(key, bucket);
    return { count: bucket.count, resetAt: new Date(bucket.resetAt) };
  }

  async peek(key: string, rule: RateLimitRule, now: Date): Promise<CounterState> {
    const existing = this.#live(key, now);
    if (existing) {
      return { count: existing.count, resetAt: new Date(existing.resetAt) };
    }
    return { count: 0, resetAt: new Date(now.getTime() + rule.windowMs) };
  }

  async clear(key: string): Promise<void> {
    this.#buckets.delete(key);
  }

  #live(key: string, now: Date): Bucket | undefined {
    const bucket = this.#buckets.get(key);
    if (!bucket) return undefined;
    if (bucket.resetAt <= now.getTime()) {
      this.#buckets.delete(key);
      return undefined;
    }
    return bucket;
  }

  #maybeSweep(now: Date): void {
    this.#operations += 1;
    if (this.#operations % this.#sweepEvery !== 0) return;

    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now.getTime()) this.#buckets.delete(key);
    }
  }
}
