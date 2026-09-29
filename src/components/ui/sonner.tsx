"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host.
 *
 * Themed from the same CSS variables as the rest of the app so a toast can never
 * look like it came from a different product. Positioned bottom-right on desktop
 * and bottom-centre on small screens, where a right-anchored toast would be
 * clipped by the thumb zone.
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      richColors
      duration={4500}
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border border-border/70 shadow-float bg-card text-card-foreground text-sm",
          description: "text-muted-foreground",
          actionButton: "rounded-lg bg-primary text-primary-foreground",
          cancelButton: "rounded-lg bg-surface-muted text-foreground",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
