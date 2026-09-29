"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
  { value: "system", icon: Monitor, labelKey: "theme.system" },
] as const;

/**
 * Theme switch.
 *
 * The icon only renders after mount: `resolvedTheme` is unknown during server
 * rendering, and rendering a guess produces a hydration mismatch that React logs
 * as an error. A placeholder keeps the layout stable in the meantime.
 */
export function ThemeToggle({ className }: { readonly className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={cn("size-9", className)} aria-hidden />;
  }

  const Icon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("theme.toggle")}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground",
          "transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          className,
        )}
      >
        <Icon className="size-[18px]" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          const active = theme === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className={cn(active && "bg-accent text-accent-foreground")}
            >
              <OptionIcon />
              {t(option.labelKey)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
