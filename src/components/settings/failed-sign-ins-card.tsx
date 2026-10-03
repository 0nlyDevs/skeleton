"use client";

import { CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FailedSignInDto } from "@/modules/login-protection/login-protection.stats";

/**
 * Failed password attempts on the resident's own account: the visible half of
 * brute-force protection. Reached from the lockout alert, it says what was
 * blocked and what to do, so a scary email always lands on an explanation.
 */
export function FailedSignInsCard({
  total,
  items,
  highlight,
  twoFactorEnabled,
}: {
  readonly total: number;
  readonly items: readonly FailedSignInDto[];
  readonly highlight: boolean;
  readonly twoFactorEnabled: boolean;
}) {
  const t = useTranslation();
  const fmt = useFormatters();

  return (
    <Card id="failed-sign-ins" className={cn(highlight && "border-warning/50 ring-2 ring-warning/20")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-[18px] text-warning" aria-hidden />
          {t("tn.security.failed_title")}
        </CardTitle>
        <CardDescription>{t("tn.security.failed_hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {total === 0 ? (
          <p className="flex items-center gap-2 text-[0.8438rem] text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            {t("tn.security.failed_none")}
          </p>
        ) : (
          <>
            <p className="text-[0.8438rem]">{t("tn.security.failed_count", { count: total })}</p>
            <ul className="flex flex-col divide-y divide-border/60">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2 text-[0.8125rem]">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{fmt.dateTime(item.at)}</span>
                    <span className="text-muted-foreground"> · {t("tn.security.failed_from", { ip: item.ip })}</span>
                  </span>
                  {item.locked ? (
                    <Badge variant="warning" className="gap-1">
                      <LockKeyhole className="size-3" aria-hidden />
                      {t("tn.security.failed_locked")}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-[0.8125rem] leading-relaxed">
              {t(twoFactorEnabled ? "tn.security.failed_advice_2fa" : "tn.security.failed_advice")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
