/**
 * "Has this password appeared in a known breach?" — Have I Been Pwned range
 * API with k-anonymity: only the first 5 hex characters of the SHA-1 leave the
 * server; the comparison happens here. Responses are padded so their size
 * reveals nothing either.
 *
 * Fail-open by design: if the service is slow or down, sign-up and password
 * changes still work (the local policy already applies). It is a second
 * layer, never a single point of failure.
 */

import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const TIMEOUT_MS = 2_500;
const cache = new Map<string, Set<string>>();
const CACHE_LIMIT = 500;

export async function isBreachedPassword(password: string): Promise<boolean> {
  if (env.PASSWORD_BREACH_CHECK !== "1") return false;

  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  let suffixes = cache.get(prefix);
  if (!suffixes) {
    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true", "User-Agent": "skeleton-password-check" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HIBP responded ${response.status}`);
      suffixes = new Set(
        (await response.text())
          .split("\n")
          .map((line) => line.trim().split(":"))
          .filter(([, count]) => Number(count) > 0)
          .map(([hash]) => hash ?? ""),
      );
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
      cache.set(prefix, suffixes);
    } catch (error) {
      logger.debug("breached-password check skipped", { error });
      return false;
    }
  }
  return suffixes.has(suffix);
}

export const BREACHED_PASSWORD_MESSAGE =
  "This password appears in known data breaches. Choose a different one.";
