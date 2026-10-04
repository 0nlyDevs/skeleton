/**
 * Session resolution for server components, route handlers and actions.
 *
 * Two things happen here that matter:
 *
 *  1. **The user object is mapped, never forwarded.** BetterAuth returns the
 *     database row; `toAuthUser` whitelists the fields the client may see, so a
 *     column added later cannot silently start leaking through the session.
 *  2. **Bans are re-checked on every read.** The sign-in hook stops a banned
 *     account from getting a *new* session; this stops an existing session from
 *     surviving a ban. Admin actions therefore take effect on the next request.
 */

import { headers } from "next/headers";

import { logger } from "@/lib/logger";
import type { AuthContext, AuthUser, Role } from "@/types";

import { resolveBanState } from "./ban";
import { auth } from "./auth";
import { isRole } from "./roles";

interface RawSessionUser {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  image?: string | null;
  role?: string | null;
  emailVerified?: boolean | null;
  twoFactorEnabled?: boolean | null;
  banned?: boolean | null;
  banExpires?: Date | null;
  banReason?: string | null;
  createdAt: Date;
}

interface RawSession {
  id: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * A session without a role means the column is not in BetterAuth's field list,
 * which fails closed but silently — an admin simply sees 403s. Warn once so the
 * cause is visible instead of guessed at.
 */
let warnedAboutMissingRole = false;

function resolveRole(raw: string | null | undefined): Role {
  if (isRole(raw)) return raw;

  if (!warnedAboutMissingRole) {
    warnedAboutMissingRole = true;
    logger.warn(
      "session user has no usable role; defaulting to USER. Every staff route will answer 403, " +
        "check that `role` is declared in `user.additionalFields` in lib/auth/auth.ts.",
      { receivedRole: raw ?? null },
    );
  }

  return "USER";
}

function toAuthUser(raw: RawSessionUser): AuthUser {
  return {
    id: String(raw.id),
    email: String(raw.email),
    name: String(raw.name),
    username: raw.username ?? null,
    image: raw.image ?? null,
    // An unrecognised role degrades to the least privilege level rather than
    // being trusted.
    role: resolveRole(raw.role) satisfies Role,
    emailVerified: raw.emailVerified === true,
    twoFactorEnabled: raw.twoFactorEnabled === true,
    createdAt: raw.createdAt.toISOString(),
  };
}

function toAuthContext(rawSession: RawSession, user: AuthUser): AuthContext {
  return {
    user,
    session: {
      id: String(rawSession.id),
      expiresAt: rawSession.expiresAt.toISOString(),
      ipAddress: rawSession.ipAddress ?? null,
      userAgent: rawSession.userAgent ?? null,
      createdAt: rawSession.createdAt.toISOString(),
    },
  };
}

/**
 * Resolve the caller, or `null` when there is no valid session.
 * Returns `null` for banned accounts and for expired sessions.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const requestHeaders = await headers();

  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result?.session || !result.user) return null;

  const rawUser = result.user as unknown as RawSessionUser;

  const banState = resolveBanState({
    banned: rawUser.banned === true,
    banExpires: rawUser.banExpires ?? null,
    banReason: rawUser.banReason ?? null,
  });
  if (banState.banned) return null;
  if (result.session.expiresAt.getTime() <= Date.now()) return null;

  return toAuthContext(result.session as unknown as RawSession, toAuthUser(rawUser));
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const context = await getAuthContext();
  return context?.user ?? null;
}
