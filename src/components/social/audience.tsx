"use client";

import { Check, Globe, Lock, UsersRound } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type Audience = "PUBLIC" | "FOLLOWERS" | "PRIVATE";

export const AUDIENCES: readonly Audience[] = ["PUBLIC", "FOLLOWERS", "PRIVATE"];

const ICON = { PUBLIC: Globe, FOLLOWERS: UsersRound, PRIVATE: Lock } as const;

export function AudienceIcon({ audience, className }: { readonly audience: Audience; readonly className?: string }) {
  const t = useTranslation();
  const Icon = ICON[audience];
  return <Icon className={cn("size-3", className)} aria-label={t(`audience.${audience}` as MessageKey)} />;
}

/** "Public / Abonnés / Moi uniquement" picker, as a compact chip. */
export function AudiencePicker({
  value,
  onChange,
  size = "sm",
}: {
  readonly value: Audience;
  readonly onChange: (audience: Audience) => void;
  readonly size?: "sm" | "md";
}) {
  const t = useTranslation();
  const Icon = ICON[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-surface-muted font-semibold text-foreground hover:bg-surface-muted/70",
          size === "sm" ? "px-2.5 py-1 text-[0.75rem]" : "px-3 py-1.5 text-[0.8125rem]",
        )}
        aria-label={t("audience.label")}
      >
        <Icon className="size-3.5" aria-hidden />
        {t(`audience.${value}` as MessageKey)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        {AUDIENCES.map((audience) => {
          const ItemIcon = ICON[audience];
          return (
            <DropdownMenuItem key={audience} onSelect={() => onChange(audience)} className="items-start">
              <ItemIcon className="mt-0.5" />
              <span className="flex-1">
                <span className="block font-medium">{t(`audience.${audience}` as MessageKey)}</span>
                <span className="block text-[0.75rem] text-muted-foreground">{t(`audience.${audience}_hint` as MessageKey)}</span>
              </span>
              {audience === value ? <Check className="mt-0.5" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
