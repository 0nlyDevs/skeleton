"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Switch } from "@/components/ui/switch";
import { CONTRAST_COOKIE, TEXT_SIZE_COOKIE, TEXT_SIZES, VISION_COOKIE, parseTextSize, type TextSize } from "@/lib/display";
import { cn } from "@/lib/utils";

import { EcoToggle } from "./eco-toggle";
import { ThemeToggle } from "./theme-toggle";

const YEAR = 60 * 60 * 24 * 365;

/** Persists a preference and applies it to `<html>` right away. */
function applyPreference(cookie: string, value: string, attribute: string, attributeValue: string | null): void {
  document.cookie = `${cookie}=${value}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
  if (attributeValue === null) document.documentElement.removeAttribute(attribute);
  else document.documentElement.setAttribute(attribute, attributeValue);
}

/**
 * Reading comfort in one place (F23, F24, F43): text size, high contrast,
 * a colour-blind palette, light or dark, eco mode. Stored in cookies so the
 * server renders the chosen display from the first byte.
 */
export function DisplayControls({ idPrefix = "display" }: { readonly idPrefix?: string }) {
  const t = useTranslation();
  const [size, setSize] = useState<TextSize>("normal");
  const [contrast, setContrast] = useState(false);
  const [vision, setVision] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setSize(parseTextSize(root.getAttribute("data-text-size") ?? undefined));
    setContrast(root.getAttribute("data-contrast") === "high");
    setVision(root.getAttribute("data-vision") === "cb");
  }, []);

  const chooseSize = (next: TextSize) => {
    applyPreference(TEXT_SIZE_COOKIE, next, "data-text-size", next === "normal" ? null : next);
    setSize(next);
  };
  const toggleContrast = (next: boolean) => {
    applyPreference(CONTRAST_COOKIE, next ? "1" : "0", "data-contrast", next ? "high" : null);
    setContrast(next);
  };
  const toggleVision = (next: boolean) => {
    applyPreference(VISION_COOKIE, next ? "cb" : "0", "data-vision", next ? "cb" : null);
    setVision(next);
  };

  return (
    <div className="flex flex-col gap-3.5">
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
                "rounded-full border py-1.5 font-semibold transition-colors",
                size === option ? "border-foreground bg-foreground text-background" : "border-border hover:bg-surface-muted",
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
        <label htmlFor={`${idPrefix}-contrast`} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("display.contrast")}</span>
          <span className="text-[0.8125rem] text-muted-foreground">{t("display.contrast_hint")}</span>
        </label>
        <Switch id={`${idPrefix}-contrast`} checked={contrast} onCheckedChange={toggleContrast} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <label htmlFor={`${idPrefix}-vision`} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("display.vision")}</span>
          <span className="text-[0.8125rem] text-muted-foreground">{t("display.vision_hint")}</span>
        </label>
        <Switch id={`${idPrefix}-vision`} checked={vision} onCheckedChange={toggleVision} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <span className="text-sm font-medium">{t("theme.toggle")}</span>
        <ThemeToggle />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{t("eco.label")}</span>
        <EcoToggle />
      </div>
    </div>
  );
}
