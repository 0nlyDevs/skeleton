"use client";

import { Languages } from "lucide-react";

import { useI18n, useLocaleSwitch } from "@/components/providers/i18n-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_LABELS, LOCALE_SHORT, LOCALES } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Language switch.
 *
 * Shows the current code (`FR`/`EN`) next to the icon rather than only an icon:
 * a jury member who does not read French needs to find this control without
 * guessing, and a globe glyph alone is ambiguous next to a theme toggle.
 */
export function LocaleToggle({ className }: { readonly className?: string }) {
  const { locale } = useI18n();
  const switchLocale = useLocaleSwitch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Langue : ${LOCALE_LABELS[locale]}`}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground",
          "transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          className,
        )}
      >
        <Languages className="size-[18px]" />
        <span className="tabular-nums">{LOCALE_SHORT[locale]}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {LOCALES.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => {
              if (option !== locale) switchLocale(option);
            }}
            className={cn(option === locale && "bg-accent text-accent-foreground")}
          >
            <span className="w-6 text-[11px] font-semibold tabular-nums opacity-70">
              {LOCALE_SHORT[option]}
            </span>
            {LOCALE_LABELS[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
