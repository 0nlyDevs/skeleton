"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AlertWatcher } from "@/components/alerts/alert-watcher";
import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import type { CityZoneId } from "@/modules/alerts/city-zones";

import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { LoadBanner } from "./load-banner";
import { OfflineNotice } from "./offline-notice";
import { MobileNav } from "./mobile-nav";
import { PlaceNav } from "./place-nav";
import { ProfileCard } from "./profile-card";
import { RightRail } from "./right-rail";
import { SideNav } from "./side-nav";
import { SecretSetupGuard } from "./secret-setup-guard";
import type { ShellRail, ShellViewer } from "./shell-types";
import { TopBar } from "./top-bar";

/**
 * The one layout of the product: a top bar with the four places, the row of
 * pages of the current place, then the page. No side menus: a page gets the
 * whole width and decides its own columns. Phones get the four places as a
 * bottom bar.
 */
export function AppShell({
  viewer,
  zone,
  rail = null,
  children,
}: {
  readonly viewer: ShellViewer | null;
  /** The viewer's district, shown in the account panel and used to personalise alerts. */
  readonly zone: CityZoneId | null;
  /** The viewer's place in the community, for the profile card. */
  readonly rail?: ShellRail | null;
  readonly children: ReactNode;
}) {
  const t = useTranslation();
  const pathname = usePathname();
  // Workspaces, the map and conversations need the full width: no right column there.
  const wide = ["/agent", "/admin", "/city-map", "/messages", "/settings"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return (
    <div className="min-h-dvh">
      <TopBar viewer={viewer} zone={zone} />
      <div className={cn("mx-auto grid w-full max-w-[1480px] grid-cols-[minmax(0,1fr)] gap-5 px-4 pb-28 pt-5 md:pb-12 lg:grid-cols-[248px_minmax(0,1fr)] lg:px-6", !wide && "xl:grid-cols-[248px_minmax(0,1fr)_300px]")}>
        <aside aria-label={t("tn.side.label")} className="sticky top-[4.75rem] hidden max-h-[calc(100dvh-5.5rem)] flex-col gap-4 self-start overflow-y-auto lg:flex">
          {viewer ? <ProfileCard viewer={viewer} zone={zone} rail={rail} /> : null}
          <SideNav viewer={viewer} />
        </aside>
        <main id="content" className="min-w-0">
          <div className="lg:hidden">
            <PlaceNav signedIn={viewer !== null} />
          </div>
          <OfflineNotice />
          <LoadBanner />
          {viewer ? <AlertWatcher /> : null}
          {children}
        </main>
        {wide ? null : (
          <aside aria-label={t("tn.rail.label")} className="sticky top-[4.75rem] hidden max-h-[calc(100dvh-5.5rem)] self-start overflow-y-auto xl:block">
            <RightRail signedIn={viewer !== null} />
          </aside>
        )}
      </div>
      <MobileNav signedIn={viewer !== null} />
      <KeyboardShortcuts />
      {viewer?.mustSetSecret ? <SecretSetupGuard /> : null}
    </div>
  );
}
