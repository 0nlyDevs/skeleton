import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[96px] w-full rounded-[0.875rem] bg-field px-3 py-2 text-[0.9375rem] leading-relaxed text-foreground",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]",
        "placeholder:text-muted-foreground/70",
        "focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        
        className,
      )}
      {...props}
    />
  );
}
