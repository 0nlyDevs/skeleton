/**
 * Client IP resolution.
 *
 * Rate limiting, audit logs and session records all key off this. It is
 * deliberately defensive: header values are attacker-controlled unless a
 * trusted proxy overwrote them, so anything that is not shaped like an IP
 * address is discarded rather than logged or counted.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}$/i;

export const UNKNOWN_IP = "unknown";

function isValidIpv4(value: string): boolean {
  const match = IPV4.exec(value);
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) <= 255);
}

export function isIpAddress(value: string): boolean {
  return isValidIpv4(value) || IPV6.test(value);
}

/** Strip an IPv6-mapped IPv4 prefix and any port suffix. */
function normalize(value: string): string {
  let candidate = value.trim();
  if (candidate.startsWith("::ffff:")) candidate = candidate.slice("::ffff:".length);
  // `1.2.3.4:5678` — only strip when the tail is a port, never from bare IPv6.
  const withPort = /^([\d.]+):(\d{1,5})$/.exec(candidate);
  if (withPort?.[1]) candidate = withPort[1];
  return candidate;
}

/**
 * Resolve the client IP from request headers.
 *
 * When `trustProxy` is set, `x-forwarded-for` is read left-to-right and the
 * first *valid* address wins — that is the client as seen by the outermost
 * proxy. Without a trusted proxy the header is ignored entirely, because any
 * client can send it.
 */
export function resolveClientIp(headers: Headers, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      for (const entry of forwarded.split(",")) {
        const candidate = normalize(entry);
        if (isIpAddress(candidate)) return candidate;
      }
    }

    const realIp = headers.get("x-real-ip");
    if (realIp) {
      const candidate = normalize(realIp);
      if (isIpAddress(candidate)) return candidate;
    }
  }

  // Some runtimes expose the socket address on the request object.
  const connectionIp = headers.get("x-connection-ip");
  if (connectionIp) {
    const candidate = normalize(connectionIp);
    if (isIpAddress(candidate)) return candidate;
  }

  return UNKNOWN_IP;
}
