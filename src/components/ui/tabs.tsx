"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/**
 * Tab list as a segmented control on a muted track. The active indicator is a
 * raised surface rather than an underline, which keeps the control readable at
 * small sizes and gives the tabs a physical feel.
 */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-lg bg-surface-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium",
        "transition-[background-color,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "data-[state=active]:animate-[fade-in_var(--duration-normal)_var(--ease-out-soft)]",
        className,
      )}
      {...props}
    />
  );
}
