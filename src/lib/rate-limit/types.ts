/**
 * Rate limiting contracts.
 *
 * The store is an interface, not a global, so the algorithm can be reused with
 * an in-memory map in tests, a MySQL table in production on shared hosting, or
 * a Redis client later — without touching a single call site.
 */

export interface RateLimitRule {
  /** Maximum number of events allowed inside the window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

export interface CounterState {
  readonly count: number;
  /** When the current window ends and the counter resets. */
  readonly resetAt: Date;
}

export interface RateLimitStore {
  /** Atomically add one event to the window, starting a new one if expired. */
  increment(key: string, rule: RateLimitRule, now: Date): Promise<CounterState>;
  /** Read the current window without modifying it. */
  peek(key: string, rule: RateLimitRule, now: Date): Promise<CounterState>;
  /** Drop a window, e.g. after a successful login. */
  clear(key: string): Promise<void>;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;
  /** Whole seconds until the window resets; safe for a `Retry-After` header. */
  readonly retryAfterSeconds: number;
}

export interface RateLimitCheck {
  readonly key: string;
  readonly rule: RateLimitRule;
}
