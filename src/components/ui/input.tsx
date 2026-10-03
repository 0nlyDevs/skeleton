import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Text input.
 *
 * `aria-invalid` is the single hook for the error style, so a form only has to
 * set that attribute (which screen readers also announce) instead of also
 * remembering a class. 16px text on mobile prevents iOS Safari's zoom-on-focus.
 */
export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-[0.9375rem] text-foreground",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]",
        "placeholder:text-muted-foreground/70",
        "hover:border-primary/40",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:mr-3 file:h-7 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:text-[0.8125rem] file:font-medium file:text-secondary-foreground",
        "aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/25",
        className,
      )}
      {...props}
    />
  );
}
