"use client";

import { MessageCircle } from "lucide-react";
import Link from "@/components/ui/link";
import { Suspense } from "react";

import { Brand } from "@/components/layout/brand";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { RealtimeStatus } from "@/components/layout/realtime-status";
import { DisplayMenu } from "@/components/layout/display-menu";
import { EcoToggle } from "@/components/layout/eco-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { Button } from "@/components/ui/button";

import { GlobalSearch } from "./global-search";
import type { ShellViewer } from "./shell-types";

export function TopBar({ viewer }: { readonly viewer: ShellViewer | null }) {
  const t = useTranslation();
  const { messageUnreadTotal } = useRealtime();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-3 lg:px-6">
        <Brand href="/" className="shrink-0" compact={false} />

        <div className="mx-auto hidden flex-1 justify-center md:flex">
          <Suspense fallback={<div className="h-10 w-full max-w-md rounded-full bg-surface-muted" />}>
            <GlobalSearch />
          </Suspense>
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <RealtimeStatus className="hidden lg:inline-flex" />
          <LocaleToggle className="hidden sm:inline-flex" />
          <DisplayMenu />
          <EcoToggle />
          <ThemeToggle />
          {viewer ? (
            <>
              <Link
                href="/messages"
                aria-label={
                  messageUnreadTotal > 0 ? `${t("nav.messages")} (${messageUnreadTotal})` : t("nav.messages")
                }
                className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground lg:hidden"
              >
                <MessageCircle className="size-[18px]" />
                {messageUnreadTotal > 0 ? (
                  <span
                    aria-hidden
                    className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[0.625rem] font-bold leading-4 text-white"
                  >
                    {messageUnreadTotal > 9 ? "9+" : messageUnreadTotal}
                  </span>
                ) : null}
              </Link>
              {/* On large screens the left rail carries Messages and Notifications;
                  the top bar keeps them only where the rail is hidden. */}
              <NotificationBell className="lg:hidden" />
              <span className="ml-1">
                <UserMenu id={viewer.id} username={viewer.username} name={viewer.name} email={viewer.email} image={viewer.image} role={viewer.role} />
              </span>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t("nav.sign_in")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/register">{t("nav.join")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="px-3 pb-2.5 md:hidden">
        <Suspense fallback={<div className="h-10 w-full rounded-full bg-surface-muted" />}>
          <GlobalSearch className="max-w-none" />
        </Suspense>
      </div>
    </header>
  );
}
