import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Layout for the authentication route group.
 *
 * Two jobs. First, a signed-in visitor is sent to their dashboard — arriving at
 * `/login` with a live session is always a mistake, and bouncing them is kinder
 * than showing a form that will fail. Second, the header carries the theme and
 * language switches: a jury member who reads English or prefers dark mode can fix
 * both *before* logging in, which is the point of putting them here.
 */
export default async function AuthLayout({ children }: { readonly children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col bg-surface/40">
      <header className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
        <Brand />
        <div className="flex items-center gap-1.5">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <main
        id="content"
        className="flex flex-1 items-center justify-center px-4 py-10 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}
