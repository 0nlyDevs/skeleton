"use client";

import type { ReactNode } from "react";

import { AlertWatcher } from "@/components/alerts/alert-watcher";
import type { CityZoneId } from "@/modules/alerts/city-zones";

import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { LoadBanner } from "./load-banner";
import { MobileNav } from "./mobile-nav";
import { PlaceNav } from "./place-nav";
import { SecretSetupGuard } from "./secret-setup-guard";
import type { ShellViewer } from "./shell-types";
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
  children,
}: {
  readonly viewer: ShellViewer | null;
  /** The viewer's district, shown in the account panel and used to personalise alerts. */
  readonly zone: CityZoneId | null;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <TopBar viewer={viewer} zone={zone} />
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 md:pb-12 lg:px-6">
        <PlaceNav signedIn={viewer !== null} />
        <main id="content" className="min-w-0">
          <LoadBanner />
          {viewer ? <AlertWatcher /> : null}
          {children}
        </main>
      </div>
      <MobileNav signedIn={viewer !== null} />
      <KeyboardShortcuts />
      {viewer?.mustSetSecret ? <SecretSetupGuard /> : null}
    </div>
  );
}
