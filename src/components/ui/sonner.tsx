"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host.
 *
 * Themed from the same CSS variables as the rest of the app so a toast can never
 * look like it came from a different product. A notice drops from the top
 * edge as a hanging tab, the same shape as the current place in the top bar.
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      offset={0}
      mobileOffset={0}
      closeButton
      richColors
      duration={4500}
      toastOptions={{
        classNames: {
          toast:
            "bubble-toast border-2 border-t-0 border-foreground/40 shadow-float bg-popover text-popover-foreground text-[0.9375rem]",
          description: "text-muted-foreground",
          actionButton: "rounded-full bg-primary text-primary-foreground",
          cancelButton: "rounded-full bg-surface-muted text-foreground",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
