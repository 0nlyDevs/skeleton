"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Avatar({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-border/70",
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center bg-accent text-[13px] font-semibold text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
