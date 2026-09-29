/**
 * In-process TTL cache.
 *
 * Built for the expensive, idempotent calls in this app — AI completions and
 * aggregate dashboard counts — where the same key is requested repeatedly and a
 * single origin query is enough.
 *
 * Two details that separate this from a naive `Map`:
 *
 *   * **In-flight de-duplication.** Concurrent misses for the same key share one
 *     promise. Without it, ten simultaneous requests each pay for the same
 *     completion — the classic cache stampede. This is the whole reason the AI
 *     proxy can be hammered without blowing the provider quota.
 *   * **Bounded size.** The map never grows past `maxEntries`; the oldest entries
 *     are evicted, so a hostile client sending unique keys cannot exhaust memory.
 *
 * It is per-process by design. On a shared host running several Passenger
 * workers each keeps its own copy — correct, just duplicated. A shared cache is a
 * drop-in replacement behind the same three functions.
 */

import { createHash } from "node:crypto";

interface CacheEntry {
  readonly value: unknown;
  readonly expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 500;

const entries = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Stable cache key from arbitrary parts. Hashed so keys stay bounded. */
export function cacheKey(...parts: readonly (string | number | boolean)[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);
}

function isExpired(entry: CacheEntry, now: number): boolean {
  return entry.expiresAt <= now;
}

/** Drop expired entries; called opportunistically before inserts. */
function prune(now: number, maxEntries: number): void {
  for (const [key, entry] of entries) {
    if (isExpired(entry, now)) entries.delete(key);
  }

  // Map preserves insertion order, so the first key is the oldest.
  while (entries.size >= maxEntries) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export interface GetOrSetOptions {
  /** Hard cap on live entries. */
  readonly maxEntries?: number;
  /** Skip the cache read (still writes). Used when freshness matters. */
  readonly skipRead?: boolean;
}

/**
 * Return the cached value for `key`, computing it once when absent.
 *
 * `compute` is guaranteed to run at most once per key per expiry window, even
 * under concurrent load. A rejected compute is never cached.
 */
export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
  options: GetOrSetOptions = {},
): Promise<T> {
  const now = Date.now();

  if (!options.skipRead) {
    const hit = entries.get(key);
    if (hit && !isExpired(hit, now)) return hit.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = compute()
    .then((value) => {
      prune(Date.now(), options.maxEntries ?? DEFAULT_MAX_ENTRIES);
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Read a value without computing it. */
export function peek<T>(key: string): T | undefined {
  const hit = entries.get(key);
  if (!hit) return undefined;
  if (isExpired(hit, Date.now())) {
    entries.delete(key);
    return undefined;
  }
  return hit.value as T;
}

/** Remove every entry whose key starts with `prefix`. Returns how many went. */
export function invalidate(prefix: string): number {
  let removed = 0;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) {
      entries.delete(key);
      removed += 1;
    }
  }
  return removed;
}

/** Test/maintenance helper. */
export function clearCache(): void {
  entries.clear();
}

export function cacheStats(): { entries: number; inFlight: number } {
  return { entries: entries.size, inFlight: inFlight.size };
}
