"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 bg-card p-5 shadow-float transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out-soft)]",
  {
    variants: {
      side: {
        // Mobile navigation slides in from the left; only `transform` animates.
        left: "inset-y-0 left-0 h-full w-[86%] max-w-xs border-r border-border/70 data-[state=closed]:-translate-x-full",
        right: "inset-y-0 right-0 h-full w-[86%] max-w-xs border-l border-border/70 data-[state=closed]:translate-x-full",
        bottom:
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-border/70 data-[state=closed]:translate-y-full",
      },
    },
    defaultVariants: { side: "left" },
  },
);

export function SheetContent({
  className,
  side = "left",
  children,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & VariantProps<typeof sheetVariants>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_var(--duration-normal)_var(--ease-out-soft)]"
      />
      <SheetPrimitive.Content
        className={cn(sheetVariants({ side }), "overflow-y-auto", className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <X className="size-4" />
          <span className="sr-only">Fermer</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 pr-8", className)} {...props} />;
}

export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
