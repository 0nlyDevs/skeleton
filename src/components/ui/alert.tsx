import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Inline message block.
 *
 * Uses `role="status"`/`role="alert"` appropriately: informational messages are
 * announced politely, errors interrupt. That distinction is why this is a
 * component rather than a div with a red border.
 */
const alertVariants = cva(
  "relative flex w-full gap-3 rounded-xl border px-4 py-3 text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        info: "border-border/80 bg-surface text-foreground [&>svg]:text-muted-foreground",
        success: "border-success/25 bg-success/8 text-foreground [&>svg]:text-success",
        warning: "border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning",
        error: "border-error/25 bg-error/8 text-foreground [&>svg]:text-error",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role={variant === "error" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-medium leading-snug tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("flex-1 text-[0.8125rem] leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
