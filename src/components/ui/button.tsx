"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Button.
 *
 * Two things make this feel considered rather than default:
 *   * `active:scale-[0.985]` — a press that responds before the action resolves.
 *   * transitions are limited to `transform`, `box-shadow` and colours, so a
 *     hover never triggers layout.
 *
 * The focus ring comes from the global `:focus-visible` rule, which keeps
 * keyboard focus visible without a permanent outline on click.
 */
const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium",
    "transition-[transform,box-shadow,background-color,color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]",
    "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_0_var(--tw-shadow-color)] shadow-primary/25 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/25",
        secondary:
          "border border-border bg-surface text-foreground hover:bg-surface-muted hover:border-primary/30",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-muted",
        ghost: "bg-transparent text-foreground hover:bg-surface-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-95 hover:shadow-md hover:shadow-destructive/25",
        link: "h-auto bg-transparent p-0 text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        md: "h-10 px-4",
        lg: "h-11 px-5 text-[0.9375rem]",
        icon: "size-9 shrink-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the child element instead of a `<button>`. */
    readonly asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      // `type` defaults to "submit" inside a form, which silently submits and
      // reloads. Every button is a button unless told otherwise.
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}

export { buttonVariants };
