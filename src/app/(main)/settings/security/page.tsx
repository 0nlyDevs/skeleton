import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SecurityForm } from "@/components/settings/security-form";
import { auth } from "@/lib/auth/auth";
import { getAuthContext } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { headers } from "next/headers";
import { hasPasswordCredential, passkeyCount } from "@/modules/users/users.service";
import { listMyFailedSignIns } from "@/modules/login-protection/login-protection.stats";

export const metadata: Metadata = { title: "Sécurité" };

/**
 * Security settings.
 *
 * Sessions come from BetterAuth's own list endpoint logic (called server-side, so
 * no extra HTTP hop). Only session ids reach the client; revocation goes through
 * `/api/users/me/sessions`, which scopes every delete to the caller.
 */
export default async function SecuritySettingsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const requestHeaders = await headers();
  const [sessions, hasPassword, failedSignIns, passkeys] = await Promise.all([
    auth.api.listSessions({ headers: requestHeaders }),
    hasPasswordCredential(context.user.id),
    listMyFailedSignIns(context.user.id),
    passkeyCount(context.user.id),
  ]);

  return (
    <SecurityForm
      twoFactorEnabled={context.user.twoFactorEnabled}
      hasPassword={hasPassword}
      alert={params.alert === "new-device"}
      passkeys={passkeys}
      alertDeviceId={typeof params.device === "string" ? params.device : null}
      lockAlert={params.alert === "locked"}
      failedSignIns={failedSignIns}
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
