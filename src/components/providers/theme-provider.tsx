"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps, ReactNode } from "react";

/**
 * Light/dark/system theming.
 *
 * The class strategy matches the `@custom-variant dark` declaration in
 * `globals.css`, and `disableTransitionOnChange` suppresses the transition
 * storm that would otherwise fire on every element at once when the theme
 * flips.
 */
export function ThemeProvider({
  children,
  ...props
}: { children: ReactNode } & ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
