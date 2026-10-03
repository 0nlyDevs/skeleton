"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { LeftRail } from "./left-rail";
import { MobileNav } from "./mobile-nav";
import { RightRail } from "./right-rail";
import type { ShellViewer } from "./shell-types";
import type { CityZoneId } from "@/modules/alerts/city-zones";
import { TopBar } from "./top-bar";
import { AlertWatcher } from "@/components/alerts/alert-watcher";

/** Pages that need the full width of the centre column. */
const WIDE_PREFIXES = ["/messages", "/settings", "/admin", "/assistant", "/notifications", "/alerts", "/city-map"];

/**
 * The one layout of the product: a top bar, the left rail (identity +
 * navigation + groups), the page, and — on social pages — the right rail
 * (contacts with presence, suggestions). Phones get a bottom tab bar and a
 * drawer with the same left rail, so navigation never changes shape.
 */
export function AppShell({
  viewer,
  zone,
  children,
}: {
  readonly viewer: ShellViewer | null;
  /** The viewer's district, shown in the rail and used to personalise alerts. */
  readonly zone: CityZoneId | null;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const wide = WIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const showRight = viewer !== null && !wide;

  return (
    <div className="min-h-dvh bg-background">
      <TopBar viewer={viewer} />
      <div
        className={cn(
          "mx-auto grid w-full max-w-[1400px] gap-5 px-3 pb-24 pt-4 lg:gap-6 lg:px-6 lg:pb-10",
          showRight
            ? "lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)_300px]"
            : "lg:grid-cols-[256px_minmax(0,1fr)]",
        )}
      >
        <aside className="sticky top-20 hidden h-[calc(100dvh-6rem)] overflow-y-auto pb-4 lg:block [scrollbar-width:thin]">
          <LeftRail viewer={viewer} zone={zone} />
        </aside>
        <main id="content" className="min-w-0">
          {viewer ? <AlertWatcher /> : null}
          {children}
        </main>
        {showRight ? (
          <aside className="sticky top-20 hidden h-[calc(100dvh-6rem)] overflow-y-auto pb-4 xl:block [scrollbar-width:thin]">
            <RightRail />
          </aside>
        ) : null}
      </div>
      <MobileNav viewer={viewer} zone={zone} />
    </div>
  );
}
