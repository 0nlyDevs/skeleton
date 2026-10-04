import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { getAuthContext } from "@/lib/auth/session";
import { viewerZone } from "@/modules/alerts/alerts.service";
import { getShellRail } from "@/modules/discovery/discovery.service";
import { needsSecretSetup } from "@/modules/users/users.service";

/**
 * Every product page renders inside the same shell, for guests and members
 * alike. Pages that need an account guard themselves (`requirePageAuth`);
 * pages that are public (feed, profiles, groups) render read-only for guests.
 */
export default async function MainLayout({ children }: { readonly children: ReactNode }) {
  const context = await getAuthContext();
  const user = context?.user ?? null;
  const [zone, mustSetSecret, rail] = user
    ? await Promise.all([viewerZone(user).catch(() => null), needsSecretSetup(user.id).catch(() => false), getShellRail(user.id).catch(() => null)])
    : [null, false, null];

  return (
    <AppShell
      viewer={
        user
          ? { id: user.id, name: user.name, username: user.username, email: user.email, image: user.image, role: user.role, mustSetSecret }
          : null
      }
      zone={zone}
      rail={rail}
    >
      {children}
    </AppShell>
  );
}
