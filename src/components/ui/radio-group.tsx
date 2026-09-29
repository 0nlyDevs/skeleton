"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function RadioGroup({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-2.5", className)}
      {...props}
    />
  );
}

export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-[18px] shrink-0 rounded-full border border-input bg-surface",
        "transition-[border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]",
        "hover:border-primary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="size-1.5 rounded-full bg-primary-foreground" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}
