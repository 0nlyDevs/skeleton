"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

import { GROUP_LABELS, isActivePath, navItemsForRole } from "./nav-items";

/**
 * Sidebar navigation.
 *
 * The active item is marked with a filled surface plus a leading accent rule
 * rather than a background on the whole row: it reads clearly at a glance without
 * the navigation competing with the page content for attention.
 */
export function SidebarNav({
  role,
  unreadCount = 0,
  onNavigate,
}: {
  readonly role: Role;
  readonly unreadCount?: number;
  readonly onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslation();
  const items = navItemsForRole(role);

  const groups: Array<"main" | "admin" | "account"> = ["main", "admin", "account"];

  return (
    <nav className="flex flex-col gap-6" aria-label={t("app.name")}>
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;

        const labelKey = GROUP_LABELS[group];

        return (
          <div key={group} className="flex flex-col gap-1">
            {labelKey ? (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {t(labelKey)}
              </p>
            ) : null}

            {groupItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    "transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                    />
                  ) : null}

                  <Icon className="size-[18px] shrink-0 opacity-80" />

                  <span className="truncate">{t(item.labelKey)}</span>

                  {item.href === "/notifications" && unreadCount > 0 ? (
                    <Badge variant="primary" className="ml-auto px-1.5 py-0 text-[11px]">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
