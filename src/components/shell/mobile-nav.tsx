"use client";

import { Menu } from "lucide-react";
import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { LeftRail } from "./left-rail";
import { ALL_NAV, isActive } from "./nav-config";
import type { ShellViewer } from "./shell-types";
import type { CityZoneId } from "@/modules/alerts/city-zones";

/** Phones: four primary destinations + a drawer holding the full left rail. */
export function MobileNav({ viewer, zone }: { readonly viewer: ShellViewer | null; readonly zone: CityZoneId | null }) {
  const t = useTranslation();
  const pathname = usePathname();
  const { unreadCount, messageUnreadTotal } = useRealtime();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // The four destinations used most on a phone; everything else is in the drawer.
  const tabs = (viewer ? ["/space", "/services", "/alerts", "/messages"] : ["/services", "/alerts", "/city-map", "/announcements"])
    .map((href) => ALL_NAV.find((item) => item.href === href))
    .filter((item): item is (typeof ALL_NAV)[number] => item !== undefined);
  const badges = { messages: messageUnreadTotal, notifications: unreadCount } as const;

  return (
    <>
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-40 [@media(max-height:30rem)]:static border-t border-border/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const badge = item.badge ? badges[item.badge] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6562rem] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {t(item.labelKey)}
                  {badge > 0 ? (
                    <span className="absolute left-1/2 top-1.5 ml-2 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[0.625rem] font-bold leading-4 text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.6562rem] font-medium text-muted-foreground"
            >
              <Menu className="size-5" aria-hidden />
              {t("nav.menu")}
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto bg-background p-4">
          <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
          <LeftRail viewer={viewer} zone={zone} />
        </SheetContent>
      </Sheet>
    </>
  );
}
