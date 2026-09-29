/**
 * Socket handshake authentication.
 *
 * A socket connection is authenticated exactly once, during the handshake, by
 * verifying the same BetterAuth session cookie the HTTP API uses. An
 * unauthenticated socket is rejected before any event handler runs, so no
 * handler has to ask "who is this?" — and a client cannot claim an identity by
 * sending it in a payload, because the identity is stored in `socket.data` by
 * the server.
 *
 * The handshake does one database read. Connections are long-lived, so that cost
 * is amortized to nothing, and it means a revoked or banned session cannot keep
 * a socket alive: the next attempt to connect fails.
 */

import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";

import { auth } from "@/lib/auth/auth";
import { resolveBanState } from "@/lib/auth/ban";
import { isRole } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";
import type { Role } from "@/types";

export interface SocketIdentity {
  readonly userId: string;
  readonly name: string;
  readonly role: Role;
}

export async function authenticateHandshake(
  headers: IncomingHttpHeaders,
): Promise<SocketIdentity | null> {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
    if (!result?.session || !result.user) return null;

    const user = result.user as unknown as {
      id: string;
      name: string;
      role?: string | null;
      banned?: boolean | null;
      banExpires?: Date | null;
    };

    if (resolveBanState({ banned: user.banned === true, banExpires: user.banExpires ?? null }).banned) {
      return null;
    }

    return {
      userId: String(user.id),
      name: String(user.name),
      role: isRole(user.role) ? user.role : "USER",
    };
  } catch (error) {
    logger.warn("socket handshake rejected", { error });
    return null;
  }
}
