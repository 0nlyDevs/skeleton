"use client";

import { Crown, Shield, ShieldCheck } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type GroupRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";

/** One look per role, used everywhere a group role appears. */
export const ROLE_STYLE = {
  OWNER: { icon: Crown, className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  ADMIN: { icon: ShieldCheck, className: "bg-primary/12 text-primary" },
  MODERATOR: { icon: Shield, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
} as const;

/**
 * "Propriétaire", "Admin" or "Modérateur" next to a name, with a tooltip that
 * says what the role can do. Plain members get no badge.
 */
export function GroupRoleBadge({
  role,
  size = "sm",
  className,
}: {
  readonly role: GroupRole | null | undefined;
  readonly size?: "xs" | "sm";
  readonly className?: string;
}) {
  const t = useTranslation();
  if (!role || role === "MEMBER") return null;
  const { icon: Icon, className: tone } = ROLE_STYLE[role];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex shrink-0 cursor-default items-center gap-1 rounded-full font-semibold leading-none",
            size === "xs" ? "px-1.5 py-0.5 text-[0.6562rem]" : "px-2 py-1 text-[0.7188rem]",
            tone,
            className,
          )}
        >
          <Icon className={size === "xs" ? "size-3" : "size-3.5"} aria-hidden />
          {t(`groups.role.${role}` as MessageKey)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{t(`groups.role_can.${role}` as MessageKey)}</TooltipContent>
    </Tooltip>
  );
}
