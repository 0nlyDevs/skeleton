/**
 * DNS behaviour for outbound requests.
 *
 * Node resolves hostnames in "verbatim" order, so a host with both A and AAAA
 * records is contacted over IPv6 whenever the resolver lists it first. On a
 * machine with no working IPv6 route — common on NixOS, Docker networks without
 * `enable_ipv6`, and some CI runners — `fetch()` then fails with a bare
 * `TypeError: fetch failed` even though `curl` works, because curl falls back to
 * IPv4 on its own and undici does not.
 *
 * That failure is invisible without care: the Resend SDK catches the network
 * error and reports it as `application_error`, so a broken network looks exactly
 * like a rejected API key. Preferring IPv4 avoids the whole class of problem;
 * IPv4-only hosts are unaffected, and dual-stack hosts lose nothing that the
 * fallback would not have found a moment later.
 *
 * Set `DNS_RESULT_ORDER=verbatim` to opt out.
 */

import { setDefaultResultOrder } from "node:dns";

let applied = false;

export function preferIpv4(): void {
  if (applied) return;
  applied = true;

  const requested = process.env.DNS_RESULT_ORDER ?? "ipv4first";

  try {
    setDefaultResultOrder(requested === "verbatim" ? "verbatim" : "ipv4first");
  } catch {
    // An unsupported order only means the process keeps Node's default; it is
    // never worth failing a request over.
  }
}

/** Runs before any module that performs an outbound request. */
preferIpv4();

/** Resolves hostnames, for diagnostics on `/api/health` and error hints. */
export function describeDnsOrder(): string {
  return process.env.DNS_RESULT_ORDER ?? "ipv4first";
}
