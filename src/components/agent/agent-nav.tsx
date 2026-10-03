"use client";

import { Briefcase, Inbox, LayoutDashboard, Megaphone, Radio, Building2 } from "lucide-react";
import { usePathname } from "next/navigation";

import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
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
export function AgentNav({
  isAdmin,
  roleLabel,
  awaitingPickup = 0,
}: {
  readonly isAdmin: boolean;
  readonly roleLabel: string;
  /** D17 — open requests with no agent, shown on the Requests tab. */
  readonly awaitingPickup?: number;
}) {
  const t = useTranslation();
  const pathname = usePathname();

  // D15 — below a section (an editor, one request), show the path back up.
  const section = ITEMS.find((item) => item.href !== "/agent" && pathname.startsWith(`${item.href}/`));
  const leaf = section ? decodeURIComponent(pathname.slice(section.href.length + 1).split("/")[0] ?? "") : "";
  const crumbs: Crumb[] | null = section
    ? [
        { label: t("tn.agent.title"), href: "/agent" },
        { label: t(section.labelKey), href: section.href },
        { label: leaf === "new" ? t("tn.breadcrumb.new") : section.href === "/agent/requests" ? leaf.toUpperCase() : t("tn.breadcrumb.edit") },
      ]
    : null;

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
              {item.href === "/agent/requests" && awaitingPickup > 0 ? (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[0.6875rem] font-semibold tabular-nums",
                    active ? "bg-primary-foreground text-primary" : "bg-warning text-warning-foreground",
                  )}
                >
                  <span aria-hidden>{awaitingPickup}</span>
                  <span className="sr-only">{t("tn.agent.pickup.badge", { count: awaitingPickup })}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {crumbs ? <Breadcrumbs label={t("tn.breadcrumb.label")} items={crumbs} className="border-t border-border/60 px-0 pt-3" /> : null}
    </div>
  );
}
