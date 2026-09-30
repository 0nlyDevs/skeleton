import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/providers/app-providers";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env.public";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: "Webcup Base",
    template: "%s · Webcup Base",
  },
  description:
    "Production-grade Next.js foundation for the 24H by Webcup sprint: authentication, roles, modular CRUD, realtime and audit trail.",
  applicationName: "Webcup Base",
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
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {/* Keyboard users land here first; the sidebar and header are skippable. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          {dictionary["nav.skip_to_content"]}
        </a>

        <AppProviders locale={locale} dictionary={dictionary}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
