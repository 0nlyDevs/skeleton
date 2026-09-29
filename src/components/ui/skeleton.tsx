import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Loading placeholder.
 *
 * A shimmering gradient sweep rather than an opacity pulse: the sweep reads as
 * "content is arriving", while a pulse reads as "this box is blinking". The
 * gradient is a pseudo-element so nothing animates `width`, and the whole thing
 * is suppressed under `prefers-reduced-motion` by the global rule.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-muted",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.06] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}
