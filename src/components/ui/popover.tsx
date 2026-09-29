"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-xl border border-border/70 bg-popover p-4 text-popover-foreground shadow-float outline-none",
          "data-[state=open]:animate-[rise-in_var(--duration-fast)_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
