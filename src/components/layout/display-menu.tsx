"use client";

import { Type } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CONTRAST_COOKIE, TEXT_SIZE_COOKIE, TEXT_SIZES, parseTextSize, type TextSize } from "@/lib/display";
import { cn } from "@/lib/utils";

const YEAR = 60 * 60 * 24 * 365;

/** Persists a preference and applies it to `<html>` right away. */
function applyPreference(cookie: string, value: string, attribute: string, attributeValue: string | null): void {
  document.cookie = `${cookie}=${value}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
  if (attributeValue === null) document.documentElement.removeAttribute(attribute);
  else document.documentElement.setAttribute(attribute, attributeValue);
}

/**
 * F23/F24 — reading comfort: a larger text size and a high-contrast palette.
 * Stored in cookies so the server renders the chosen display from the first byte.
 */
export function DisplayMenu({ className }: { readonly className?: string }) {
  const t = useTranslation();
  const [size, setSize] = useState<TextSize>("normal");
  const [contrast, setContrast] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setSize(parseTextSize(root.getAttribute("data-text-size") ?? undefined));
    setContrast(root.getAttribute("data-contrast") === "high");
  }, []);

  const chooseSize = (next: TextSize) => {
    applyPreference(TEXT_SIZE_COOKIE, next, "data-text-size", next === "normal" ? null : next);
    setSize(next);
  };

  const toggleContrast = (next: boolean) => {
    applyPreference(CONTRAST_COOKIE, next ? "1" : "0", "data-contrast", next ? "high" : null);
    setContrast(next);
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("display.label")}
        title={t("display.label")}
        className={cn(
          "grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
          (size !== "normal" || contrast) && "text-primary",
          className,
        )}
      >
        <Type className="size-[1.125rem]" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex flex-col gap-4">
        <p className="font-semibold">{t("display.label")}</p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("display.text_size")}</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_SIZES.map((option, index) => (
              <button
                key={option}
                type="button"
                aria-pressed={size === option}
                aria-label={t(`display.size.${option}`)}
                onClick={() => chooseSize(option)}
                className={cn(
                  "rounded-lg border py-1.5 font-semibold transition-colors",
                  size === option ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-surface-muted",
                )}
                style={{ fontSize: `${0.8 + index * 0.15}rem` }}
              >
                A
              </button>
            ))}
          </div>
          <p className="text-[0.8125rem] text-muted-foreground" aria-live="polite">
            {t(`display.size.${size}`)}
          </p>
        </fieldset>

        <div className="flex items-start justify-between gap-3">
          <label htmlFor="display-contrast" className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("display.contrast")}</span>
            <span className="text-[0.8125rem] text-muted-foreground">{t("display.contrast_hint")}</span>
          </label>
          <Switch id="display-contrast" checked={contrast} onCheckedChange={toggleContrast} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
