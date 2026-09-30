import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SecurityForm } from "@/components/settings/security-form";
import { auth } from "@/lib/auth/auth";
import { getAuthContext } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Sécurité" };

/**
 * Security settings.
 *
 * Sessions come from BetterAuth's own list endpoint logic (called server-side, so
 * no extra HTTP hop), and the current session is identified by its token — the
 * only field the client needs to distinguish "this device" from the others.
 */
export default async function SecuritySettingsPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const requestHeaders = await headers();
  const sessions = await auth.api.listSessions({ headers: requestHeaders });

  return (
    <SecurityForm
      twoFactorEnabled={context.user.twoFactorEnabled}
      googleEnabled={env.googleOAuthEnabled}
      currentSessionToken={context.session.id}
      sessions={sessions.map((session) => ({
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
        createdAt: session.createdAt.toISOString(),
      }))}
    />
  );
}
