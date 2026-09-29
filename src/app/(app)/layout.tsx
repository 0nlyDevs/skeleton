import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/shell";
import { requireAuth } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Espace connecté" };

/**
 * Layout for the authenticated area.
 *
 * This is the real access control for pages — the middleware only redirects
 * humans and cannot read the database. `requireAuth` re-resolves the session from
 * the cookie on every server render, re-checks bans, and bounces to `/login` when
 * there is no live session, so a stale or revoked cookie never renders app data.
 */
export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const context = await requireAuth().catch(() => null);
  if (!context) redirect("/login");

  return <AppShell user={context.user}>{children}</AppShell>;
}
