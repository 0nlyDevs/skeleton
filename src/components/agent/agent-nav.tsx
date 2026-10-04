"use client";

import {
  Briefcase,
  Building2,
  BusFront,
  CalendarClock,
  Construction,
  DatabaseBackup,
  FileDown,
  History,
  Inbox,
  Landmark,
  Vote,
  LayoutDashboard,
  Megaphone,
  MessageSquareHeart,
  Radio,
  Siren,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Item {
  readonly href: string;
  readonly labelKey: MessageKey;
  readonly icon: typeof Inbox;
  readonly adminOnly?: boolean;
}

interface Group {
  readonly id: string;
  readonly labelKey: MessageKey;
  readonly items: readonly Item[];
}

/**
 * The workspace in four groups named after the work: answer residents,
 * inform the city, run the services, follow and protect the data. Each group
 * has at most five pages, so nothing needs a sideways scroll.
 */
const GROUPS: readonly Group[] = [
  {
    id: "requests",
    labelKey: "tn.agent.group.requests",
    items: [
      { href: "/agent/requests", labelKey: "tn.agent.nav.requests", icon: Inbox },
      { href: "/agent/appointments", labelKey: "tn.appointments.nav", icon: CalendarClock },
      { href: "/agent/feedback", labelKey: "tn.feedback.nav", icon: MessageSquareHeart },
      { href: "/agent/citizens", labelKey: "tn.agent.nav.citizens", icon: Users },
    ],
  },
  {
    id: "inform",
    labelKey: "tn.agent.group.inform",
    items: [
      { href: "/agent/announcements", labelKey: "tn.agent.nav.news", icon: Megaphone },
      { href: "/agent/alerts/new", labelKey: "tn.nav.alerts", icon: Siren },
      { href: "/agent/official", labelKey: "tn.official.nav", icon: Landmark, adminOnly: true },
      { href: "/agent/participation", labelKey: "tn.participate.admin.nav", icon: Vote, adminOnly: true },
    ],
  },
  {
    id: "services",
    labelKey: "tn.agent.group.services",
    items: [
      { href: "/agent/service-status", labelKey: "tn.availability.nav", icon: Construction },
      { href: "/agent/services", labelKey: "tn.agent.nav.services", icon: Building2, adminOnly: true },
      { href: "/agent/transports", labelKey: "tn.agent.nav.transports", icon: BusFront },
    ],
  },
  {
    id: "follow",
    labelKey: "tn.agent.group.follow",
    items: [
      { href: "/agent/feed", labelKey: "tn.agent.nav.feed", icon: Radio },
      { href: "/agent/history", labelKey: "tn.agent.nav.history", icon: History },
      { href: "/agent/exports", labelKey: "tn.export.nav", icon: FileDown },
      { href: "/agent/data", labelKey: "tn.data.nav", icon: DatabaseBackup, adminOnly: true },
    ],
  },
];

const ALL: readonly Item[] = GROUPS.flatMap((group) => group.items);

function isOn(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The agent workspace's header: who and where, then the four groups as large
 * tabs, then the pages of the open group. It wraps on a phone instead of
 * scrolling sideways.
 */
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

  const groups = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => isAdmin || !item.adminOnly) })).filter((group) => group.items.length > 0);
  const onDashboard = pathname === "/agent";
  const current = groups.find((group) => group.items.some((item) => isOn(pathname, item.href)));

  // D15 — below a section (an editor, one request), show the path back up.
  const section = ALL.find((item) => pathname.startsWith(`${item.href}/`));
  const leaf = section ? decodeURIComponent(pathname.slice(section.href.length + 1).split("/")[0] ?? "") : "";
  const crumbs: Crumb[] | null = section
    ? [
        { label: t("tn.agent.title"), href: "/agent" },
        { label: t(section.labelKey), href: section.href },
        { label: leaf === "new" ? t("tn.breadcrumb.new") : section.href === "/agent/requests" ? leaf.toUpperCase() : t("tn.breadcrumb.edit") },
      ]
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-foreground text-background">
            <Briefcase className="size-[1.125rem]" aria-hidden />
          </span>
          <div>
            <p className="text-[1.0625rem] font-semibold leading-tight">{t("tn.agent.title")}</p>
            <p className="text-[0.8125rem] text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <Link href="/space" className="rounded-full px-3 py-1.5 text-[0.875rem] font-medium hover:bg-surface-muted">
          {t("tn.agent.back_citizen")}
        </Link>
      </div>

      <nav aria-label={t("tn.agent.title")} className="flex flex-col gap-3">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <li>
            <Link
              href="/agent"
              aria-current={onDashboard ? "page" : undefined}
              className={cn(
                "flex h-full items-center gap-2.5 rounded-2xl px-4 py-3 text-[0.9375rem] font-semibold transition-colors",
                onDashboard ? "bg-foreground text-background" : "bg-surface-muted hover:bg-accent",
              )}
            >
              <LayoutDashboard className="size-[1.125rem] shrink-0" aria-hidden />
              {t("tn.agent.nav.dashboard")}
            </Link>
          </li>
          {groups.map((group) => {
            const active = current?.id === group.id;
            const first = group.items[0];
            return (
              <li key={group.id}>
                <Link
                  href={first?.href ?? "/agent"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[0.9375rem] font-semibold transition-colors",
                    active ? "bg-foreground text-background" : "bg-surface-muted hover:bg-accent",
                  )}
                >
                  {t(group.labelKey)}
                  {group.id === "requests" && awaitingPickup > 0 ? (
                    <span className="grid min-w-6 place-items-center rounded-full bg-bead px-1.5 text-[0.75rem] font-bold leading-6 text-bead-foreground">
                      <span aria-hidden>{awaitingPickup}</span>
                      <span className="sr-only">{t("tn.agent.pickup.badge", { count: awaitingPickup })}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {current ? (
          <ul className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
            {current.items.map((item) => {
              const on = isOn(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 py-2 text-[0.9375rem] font-medium transition-colors",
                      on ? "bg-accent text-foreground ring-2 ring-foreground/70" : "bg-surface-muted hover:bg-accent",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </nav>
      {crumbs ? <Breadcrumbs label={t("tn.breadcrumb.label")} items={crumbs} className="border-t border-border/60 px-0 pt-3" /> : null}
    </div>
  );
}
