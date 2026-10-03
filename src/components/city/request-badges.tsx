"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { MessageKey } from "@/lib/i18n";

const STATUS_VARIANT: Readonly<Record<string, BadgeProps["variant"]>> = {
  NEW: "primary",
  IN_PROGRESS: "warning",
  WAITING_CITIZEN: "outline",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const PRIORITY_VARIANT: Readonly<Record<string, BadgeProps["variant"]>> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "warning",
  URGENT: "error",
};

export function RequestStatusBadge({ status }: { readonly status: string }) {
  const t = useTranslation();
  return <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{t(`tn.status.${status}` as MessageKey)}</Badge>;
}

export function RequestPriorityBadge({ priority }: { readonly priority: string }) {
  const t = useTranslation();
  if (priority === "NORMAL") return null;
  return <Badge variant={PRIORITY_VARIANT[priority] ?? "neutral"}>{t(`tn.priority.${priority}` as MessageKey)}</Badge>;
}

export function NeedsActionBadge() {
  const t = useTranslation();
  return (
    <Badge variant="error">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t("tn.needs_action")}
    </Badge>
  );
}
