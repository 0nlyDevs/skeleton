"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AuthUser } from "@/types";

import { Brand } from "./brand";
import { LocaleToggle } from "./locale-toggle";
import { RealtimeStatus } from "./realtime-status";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Topbar.
 *
 * Below `lg` the sidebar becomes a drawer, so the trigger is the only way to
 * reach the navigation on a phone. It renders in the same DOM position at every
 * breakpoint — only its visibility changes — which keeps the layout stable while
 * resizing.
 */
export function Topbar({ user, title }: { readonly user: AuthUser; readonly title?: string }) {
  const t = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md lg:px-6">
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={t("nav.open_menu")}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <Brand href="/dashboard" className="lg:hidden" compact />

      {title ? (
        <h1 className="hidden truncate text-[15px] font-semibold tracking-tight lg:block">
          {title}
        </h1>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        <RealtimeStatus className="mr-1" />
        <NotificationBell />
        <LocaleToggle />
        <ThemeToggle />
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <UserMenu
          name={user.name}
          email={user.email}
          image={user.image}
          role={user.role}
        />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="gap-6">
          <SheetHeader>
            <SheetTitle>
              <Brand href="/dashboard" />
            </SheetTitle>
          </SheetHeader>
          <Sidebar role={user.role} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
