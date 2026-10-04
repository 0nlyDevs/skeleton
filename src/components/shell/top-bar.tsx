"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { Brand } from "@/components/layout/brand";
import { DisplayMenu } from "@/components/layout/display-menu";
import { EcoToggle } from "@/components/layout/eco-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";
import type { CityZoneId } from "@/modules/alerts/city-zones";

import { AccountPanel } from "./account-panel";
import { GlobalSearch } from "./global-search";
import { PLACES, STAFF_NAV, isActive, placeFor } from "./nav-config";
import type { ShellViewer } from "./shell-types";

/**
 * One bar: the logo, the four places, search, notifications, the account.
 * The current place is a tab cut into the bar, so "where am I" is a shape,
 * not a colour.
 */
export function TopBar({ viewer, zone }: { readonly viewer: ShellViewer | null; readonly zone: CityZoneId | null }) {
  const t = useTranslation();
  const pathname = usePathname();
  const current = placeFor(pathname);

  // F44 — on a short screen (strong zoom) the bar scrolls away instead of covering the page.
  return (
    <header className="sticky top-0 z-40 bg-card [@media(max-height:30rem)]:static">
      <div className="mx-auto flex h-[3.75rem] w-full max-w-[1480px] items-stretch gap-3 px-4 lg:px-6">
        <Brand href={viewer ? "/space" : "/"} className="shrink-0 self-center" />

        <nav aria-label={t("nav.label")} className="mx-auto hidden items-stretch gap-1 md:flex">
          {PLACES.map((place) => {
            const active = current?.id === place.id;
            const href = place.id === "home" && !viewer ? "/start" : place.href;
            return (
              <Link key={place.id} href={href} aria-current={active ? "page" : undefined} className={cn("place-tab", active && "place-tab-on")}>
                {t(place.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <div className="hidden w-52 lg:block xl:w-60">
            <Suspense fallback={<div className="h-9 w-full rounded-full bg-surface-muted" />}>
              <GlobalSearch />
            </Suspense>
          </div>
          <Link
            href="/search"
            aria-label={t("common.search")}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors duration-[var(--duration-normal)] ease-[var(--ease-out-soft)] lg:hidden"
          >
            <Search className="size-[1.125rem]" aria-hidden />
          </Link>
          {viewer ? (
            <>
              {/* Staff reach their workspace in one tap, from any page and any screen size. */}
              {STAFF_NAV.filter((item) => item.roles?.includes(viewer.role)).map((item) => {
                const on = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    aria-label={t(item.labelKey)}
                    title={t(item.labelKey)}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[0.8125rem] font-semibold transition-colors duration-[var(--duration-normal)] ease-[var(--ease-out-soft)] xl:px-3.5",
                      on ? "bg-foreground text-background" : "bg-surface-muted text-foreground hover:bg-accent",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    <span className="hidden xl:inline">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
              <ThemeToggle className="hidden sm:grid" />
              <EcoToggle className="hidden sm:grid" />
              <DisplayMenu />
              <NotificationBell />
              <AccountPanel viewer={viewer} zone={zone} />
            </>
          ) : (
            <>
              <LocaleToggle className="hidden sm:inline-flex" />
              <ThemeToggle />
              <EcoToggle className="hidden sm:grid" />
              <DisplayMenu />
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t("nav.sign_in")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/register">{t("tn.account.join")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
