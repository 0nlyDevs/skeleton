import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";

import { AppProviders } from "@/components/providers/app-providers";
import { getCurrentUser } from "@/lib/auth/session";
import { ECO_COOKIE } from "@/lib/eco";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env.public";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: "Skeleton",
    template: "%s · Skeleton",
  },
  description:
    "Skeleton — a social network to share posts, talk in real time and gather in groups.",
  applicationName: "Skeleton",
  // The app is authenticated; there is nothing here for a crawler to index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#131519" },
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
  const eco = (await cookies()).get(ECO_COOKIE)?.value === "1";
  // Per-request CSP nonce minted by `src/proxy.ts`; inline scripts injected by
  // providers (the theme bootstrap) must carry it or the browser blocks them.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      {...(eco ? { "data-eco": "" } : {})}
    >
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
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
