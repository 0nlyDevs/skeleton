import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SecurityForm } from "@/components/settings/security-form";
import { auth } from "@/lib/auth/auth";
import { getAuthContext } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { headers } from "next/headers";
import { hasPasswordCredential } from "@/modules/users/users.service";

export const metadata: Metadata = { title: "Sécurité" };

/**
 * Security settings.
 *
 * Sessions come from BetterAuth's own list endpoint logic (called server-side, so
 * no extra HTTP hop). Only session ids reach the client; revocation goes through
 * `/api/users/me/sessions`, which scopes every delete to the caller.
 */
export default async function SecuritySettingsPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const requestHeaders = await headers();
  const [sessions, hasPassword] = await Promise.all([
    auth.api.listSessions({ headers: requestHeaders }),
    hasPasswordCredential(context.user.id),
  ]);

  return (
    <SecurityForm
      twoFactorEnabled={context.user.twoFactorEnabled}
      hasPassword={hasPassword}
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
      currentSessionId={context.session.id}
      // Ids only: a session token is a bearer credential and stays server-side.
      sessions={sessions.map((session) => ({
        id: session.id,
        expiresAt: session.expiresAt.toISOString(),
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
        createdAt: session.createdAt.toISOString(),
      }))}
    />
  );
}
