"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import type { MessageKey } from "@/lib/i18n";
import type { AuthUser } from "@/types";

import { Brand } from "./brand";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Longest-prefix match, so `/admin/users` resolves to its own title. */
const TITLES: ReadonlyArray<readonly [string, MessageKey]> = [
  ["/settings/profile", "settings.profile.title"],
  ["/settings/security", "settings.security.title"],
  ["/settings/notifications", "settings.notifications.title"],
  ["/admin/users", "admin.users.title"],
  ["/admin/moderation", "admin.moderation.title"],
  ["/admin/audit", "admin.audit.title"],
  ["/admin/settings", "admin.settings.title"],
  ["/admin", "admin.title"],
  ["/posts/new", "posts.new.title"],
  ["/posts", "posts.title"],
  ["/chat", "chat.title"],
  ["/notifications", "notifications.title"],
  ["/ai", "ai.title"],
  ["/dashboard", "dashboard.title"],
];

function usePageTitle(pathname: string): string | undefined {
  const t = useTranslation();
  const match = TITLES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? t(match[1]) : undefined;
}

/**
 * Shell for every authenticated page.
 *
 * A fixed rail on desktop and a drawer on mobile, with the page in the middle.
 * The sidebar column is a grid track rather than a fixed-position panel, so the
 * content never slides underneath it and no `padding-left` magic number has to be
 * kept in sync with the rail width.
 */
export function AppShell({ user, children }: { readonly user: AuthUser; readonly children: ReactNode }) {
  const pathname = usePathname();
  const title = usePageTitle(pathname);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-border/70 bg-surface/40 px-3 py-5 lg:flex">
        <div className="px-2 pb-6">
          <Brand href="/dashboard" />
        </div>
        <Sidebar role={user.role} />
        <p className="mt-auto px-3 pt-6 text-[11px] leading-relaxed text-muted-foreground/70">
          {user.email}
        </p>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <Topbar user={user} {...(title ? { title } : {})} />
        <main id="content" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
