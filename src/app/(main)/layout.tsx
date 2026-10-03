import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { isAiReachable } from "@/lib/ai/provider";
import { getAuthContext } from "@/lib/auth/session";
import { getShellRail } from "@/modules/discovery/discovery.service";

/**
 * Every product page renders inside the same shell, for guests and members
 * alike. Pages that need an account guard themselves (`requirePageAuth`);
 * pages that are public (feed, profiles, groups) render read-only for guests.
 */
export default async function MainLayout({ children }: { readonly children: ReactNode }) {
  const context = await getAuthContext();
  const user = context?.user ?? null;
  const rail = user ? await getShellRail(user.id).catch(() => null) : null;

  return (
    <AppShell
      viewer={
        user
          ? { id: user.id, name: user.name, username: user.username, email: user.email, image: user.image, role: user.role }
          : null
      }
      rail={rail}
      aiEnabled={isAiReachable()}
    >
      {children}
    </AppShell>
  );
}
