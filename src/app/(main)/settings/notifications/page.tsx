import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { getAuthContext } from "@/lib/auth/session";
import { findPreferences } from "@/modules/notifications/notifications.repository";

export const metadata: Metadata = { title: "Préférences" };

export default async function NotificationSettingsPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const prefs = await findPreferences(context.user.id);

  return (
    <NotificationPreferences
      initial={{
        // Matches the Prisma column defaults, so a user who never saved the
        // form sees exactly what `deliverEmail` enforces (email on message off
        // until explicitly enabled).
        emailOnMessage: prefs?.emailOnMessage ?? false,
        emailOnMention: prefs?.emailOnMention ?? true,
        emailOnSystem: prefs?.emailOnSystem ?? true,
      }}
    />
  );
}
