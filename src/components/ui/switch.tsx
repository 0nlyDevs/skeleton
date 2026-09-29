"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Switch.
 *
 * The knob translates on the X axis rather than animating `left`, so toggling
 * stays on the compositor. 44px of hit area around a 24px track keeps it usable
 * on a phone without a visually heavy control.
 */
export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent",
        "transition-colors duration-[var(--duration-normal)] ease-[var(--ease-out-soft)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-surface-muted data-[state=unchecked]:border-border",
        "data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-[18px] rounded-full bg-white shadow-sm ring-0",
          "transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out-soft)]",
          "translate-x-0.5 data-[state=checked]:translate-x-[22px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
