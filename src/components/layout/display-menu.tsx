"use client";

import { Type } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { DisplayControls } from "./display-controls";

/**
 * F23/F24/F43 — reading comfort for visitors without an account menu: the
 * same controls as in the account panel, behind one button.
 */
export function DisplayMenu({ className }: { readonly className?: string }) {
  const t = useTranslation();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("display.label")}
        title={t("display.label")}
        className={cn("grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground", className)}
      >
        <Type className="size-[1.125rem]" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <p className="font-semibold">{t("display.label")}</p>
        <DisplayControls idPrefix="display-menu" />
      </PopoverContent>
    </Popover>
  );
}
