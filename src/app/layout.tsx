import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";

import { SpaceBackdrop } from "@/components/layout/space-backdrop";
import { OfficialMessageBand } from "@/components/city/official-message-band";
import { AppProviders } from "@/components/providers/app-providers";
import { getCurrentUser } from "@/lib/auth/session";
import { CONTRAST_COOKIE, TEXT_SIZE_COOKIE, VISION_COOKIE, parseTextSize } from "@/lib/display";
import { ECO_AUTO_COOKIE, ECO_AUTO_SCRIPT, ECO_COOKIE, resolveEcoMode } from "@/lib/eco";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env.public";

import { cabinetGrotesk, generalSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: "Bubble",
    template: "%s · Bubble",
  },
  description:
    "Bubble — la plateforme des habitants de Terra Nova : services de la ville, annonces, démarches et échanges avec l'administration.",
  applicationName: "Bubble",
  // The app is authenticated; there is nothing here for a crawler to index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ed" },
    { media: "(prefers-color-scheme: dark)", color: "#272b35" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout.
 *
 * The locale is resolved on the server and handed to the client provider along
 * with the dictionary it already used, so the first HTML byte is in the right
 * language. `suppressHydrationWarning` is required on `<html>` because
 * `next-themes` writes the theme class before React hydrates — that mismatch is
 * intentional and React's warning would be noise.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, requestHeaders, viewer] = await Promise.all([
    getLocale(),
    headers(),
    getCurrentUser().catch(() => null),
  ]);
  const dictionary = getDictionary(locale);
  const cookieStore = await cookies();
  const eco = resolveEcoMode({
    choice: cookieStore.get(ECO_COOKIE)?.value,
    autoCookie: cookieStore.get(ECO_AUTO_COOKIE)?.value,
    saveData: requestHeaders.get("save-data"),
    ect: requestHeaders.get("ect"),
  });
  const textSize = parseTextSize(cookieStore.get(TEXT_SIZE_COOKIE)?.value);
  const highContrast = cookieStore.get(CONTRAST_COOKIE)?.value === "1";
  const colourBlind = cookieStore.get(VISION_COOKIE)?.value === "cb";
  // Per-request CSP nonce minted by `src/proxy.ts`; inline scripts injected by
  // providers (the theme bootstrap) must carry it or the browser blocks them.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${generalSans.variable} ${cabinetGrotesk.variable}`}
      {...(eco.on ? { "data-eco": "" } : {})}
      {...(eco.auto ? { "data-eco-auto": "" } : {})}
      {...(textSize !== "normal" ? { "data-text-size": textSize } : {})}
      {...(highContrast ? { "data-contrast": "high" } : {})}
      {...(colourBlind ? { "data-vision": "cb" } : {})}
    >
      <head>
        {/* Before the first paint: a slow connection gets the light page at once. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: ECO_AUTO_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {/* Keyboard users land here first; the sidebar and header are skippable. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          {dictionary["nav.skip_to_content"]}
        </a>

        <AppProviders
          locale={locale}
          dictionary={dictionary}
          viewerId={viewer?.id ?? null}
          {...(nonce ? { nonce } : {})}
        >
          {/* F73 — the High Council's official message reaches every screen. */}
          <SpaceBackdrop />
          <OfficialMessageBand />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
