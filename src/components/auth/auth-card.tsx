import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared frame for every authentication screen.
 *
 * Keeping the width, spacing and heading rhythm in one place is what makes the
 * six auth pages look like one product rather than six. `aria-labelledby` points
 * at the heading so a screen reader announces the purpose of the page on arrival.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className={cn(
        "w-full max-w-[26rem] rounded-2xl border border-border/70 bg-card p-6 shadow-panel sm:p-7",
        className,
      )}
    >
      <header className="flex flex-col gap-1.5 pb-6">
        <h1 id="auth-title" className="text-[1.375rem] font-semibold tracking-[-0.015em]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[0.875rem] leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>

      {children}

      {footer ? (
        <footer className="mt-6 border-t border-border/70 pt-5 text-center text-[0.8125rem] text-muted-foreground">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
