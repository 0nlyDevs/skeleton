"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Dictionary, Locale } from "@/lib/i18n";

import { I18nProvider } from "./i18n-provider";
import { CallProvider } from "@/components/calls/call-provider";

import { ServiceWorkerRegistration } from "./service-worker";

import { RealtimeProvider } from "./realtime-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * Single mount point for every client provider.
 *
 * Order matters: the theme must wrap everything so no element renders in the
 * wrong palette, and realtime sits inside i18n because a notification toast can
 * be localized. One tooltip provider is mounted here rather than per tooltip, so
 * Radix keeps a single shared hover delay across the app.
 *
 * The `suppressHydrationWarning` on `<html>` (set in the root layout) is what
 * lets `next-themes` write the class before React hydrates without a warning.
 */
export function AppProviders({
  locale,
  dictionary,
  viewerId,
  nonce,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  /** The signed-in user, resolved on the server; `null` for guests. */
  viewerId: string | null;
  nonce?: string;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider {...(nonce ? { nonce } : {})}>
      <I18nProvider locale={locale} dictionary={dictionary}>
        <TooltipProvider delayDuration={300}>
          <RealtimeProvider viewerId={viewerId}>
            <CallProvider viewerId={viewerId}>
              {children}
              <Toaster />
              <ServiceWorkerRegistration />
            </CallProvider>
          </RealtimeProvider>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
