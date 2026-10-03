"use client";

import { Bell, Database, Eye, ShieldCheck, UserRound } from "lucide-react";
import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS: ReadonlyArray<{ href: string; key: MessageKey; icon: typeof UserRound }> = [
  { href: "/settings/profile", key: "settings.tabs.profile", icon: UserRound },
  { href: "/settings/security", key: "settings.tabs.account", icon: ShieldCheck },
  { href: "/settings/privacy", key: "settings.tabs.privacy", icon: Eye },
  { href: "/settings/notifications", key: "settings.tabs.notifications", icon: Bell },
  { href: "/settings/data", key: "tn.data.tab", icon: Database },
];

export function SettingsTabs({ profileHref }: { readonly profileHref: string | null }) {
  const t = useTranslation();
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label={t("settings.title")} className="flex gap-1 overflow-x-auto rounded-2xl bg-card p-1 shadow-panel">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[0.8438rem] font-semibold transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
      {profileHref ? (
        <Link href={profileHref} className="text-[0.8125rem] font-medium text-primary hover:underline">
          {t("settings.view_profile")}
        </Link>
      ) : null}
    </div>
  );
}
