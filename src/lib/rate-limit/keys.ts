import { createHash } from "node:crypto";

/**
 * Rate-limit keys must be bounded in length and free of personal data, but the
 * identifier they derive from (an email address, a user id, an IP) is exactly
 * the kind of value that must not sit in a plaintext index. Hashing gives us
 * both: fixed 40-character keys with no PII at rest.
 */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

/**
 * Build a namespaced key.
 *
 * `scope` is always a constant taken from code, never from input, so the
 * namespace prefix cannot be spoofed. The variable parts are hashed together so
 * that `("login", "ip", "1.2.3.4")` and `("login", "1.2.3.4", "ip")` differ.
 */
export function rateLimitKey(
  scope: string,
  ...parts: readonly (string | number | undefined | null)[]
): string {
  const material = parts
    .filter((part) => part !== undefined && part !== null && `${part}`.length > 0)
    .map((part) => String(part))
    .join("\u0000");

  return `${scope}:${hashIdentifier(material.length > 0 ? material : "anonymous")}`;
}

/** Convenience for the common "same limit for IP **and** account" pattern. */
export function accountAndIpKeys(
  scope: string,
  identifier: string,
  ip: string,
): { accountKey: string; ipKey: string } {
  return {
    accountKey: rateLimitKey(scope, "account", identifier.toLowerCase()),
    ipKey: rateLimitKey(scope, "ip", ip),
  };
}
