"use client";

import { Briefcase, Inbox, LayoutDashboard, Megaphone, Radio, Building2 } from "lucide-react";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEMS: readonly { href: string; labelKey: MessageKey; icon: typeof Inbox; adminOnly?: boolean }[] = [
  { href: "/agent", labelKey: "tn.agent.nav.dashboard", icon: LayoutDashboard },
  { href: "/agent/requests", labelKey: "tn.agent.nav.requests", icon: Inbox },
  { href: "/agent/feed", labelKey: "tn.agent.nav.feed", icon: Radio },
  { href: "/agent/announcements", labelKey: "tn.agent.nav.news", icon: Megaphone },
  { href: "/agent/services", labelKey: "tn.agent.nav.services", icon: Building2, adminOnly: true },
];

/** The agent workspace's own header and tabs, distinct from the citizen space. */
export function AgentNav({ isAdmin, roleLabel }: { readonly isAdmin: boolean; readonly roleLabel: string }) {
  const t = useTranslation();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-accent to-card p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Briefcase className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold leading-tight">{t("tn.agent.title")}</p>
            <p className="text-[0.7812rem] text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <Link href="/space" className="text-[0.8125rem] text-primary hover:underline">
          {t("tn.agent.back_citizen")}
        </Link>
      </div>
      <nav aria-label={t("tn.agent.title")} className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => {
          const active = item.href === "/agent" ? pathname === "/agent" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
