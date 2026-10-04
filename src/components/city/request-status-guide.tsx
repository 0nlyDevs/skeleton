"use client";

import { CheckCircle2, Hourglass, Inbox, Lock, UserCheck } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { PlainExplain } from "./plain-explain";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

const GUIDE = {
  NEW: { icon: Inbox, tone: "border-border/70 bg-card", key: "new" },
  IN_PROGRESS: { icon: UserCheck, tone: "border-primary/30 bg-accent/50", key: "in_progress" },
  WAITING_CITIZEN: { icon: Hourglass, tone: "border-warning/50 bg-warning/10", key: "waiting" },
  RESOLVED: { icon: CheckCircle2, tone: "border-success/40 bg-success/10", key: "resolved" },
  CLOSED: { icon: Lock, tone: "border-border/70 bg-surface-muted", key: "closed" },
} as const;

/**
 * F49 — where the request stands, in two plain sentences: what it means, and
 * what the resident has to do (often: nothing). When the city waits for the
 * resident, the block says so first and the button goes straight to the reply.
 */
export function RequestStatusGuide({ status }: { readonly status: string }) {
  const t = useTranslation();
  const guide = GUIDE[status as keyof typeof GUIDE] ?? GUIDE.NEW;
  const Icon = guide.icon;
  const waiting = status === "WAITING_CITIZEN";

  return (
    <section role={waiting ? "alert" : "status"} aria-labelledby="status-guide" className={cn("flex gap-3 rounded-2xl border p-4", guide.tone)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", waiting ? "text-warning" : "text-primary")} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1.5 text-[0.9375rem]">
        <h2 id="status-guide" className="font-semibold">
          {t(`tn.request.guide.${guide.key}.title`)}
        </h2>
        <p>
          <span className="text-muted-foreground">{t("tn.request.guide.means")} </span>
          {t(`tn.request.guide.${guide.key}.means`)}
        </p>
        <p className="font-medium">
          <span className="font-normal text-muted-foreground">{t("tn.request.guide.todo")} </span>
          {t(`tn.request.guide.${guide.key}.todo`)}
        </p>
        {waiting || status === "RESOLVED" ? (
          <Button asChild size="sm" variant={waiting ? "primary" : "secondary"} className="mt-1 w-fit">
            <a href="#reply">{t(waiting ? "tn.request.guide.reply_now" : "tn.request.guide.reopen")}</a>
          </Button>
        ) : null}
        {status === "CLOSED" ? (
          <Button asChild size="sm" variant="secondary" className="mt-1 w-fit">
            <Link href="/contact">{t("tn.request.guide.new_request")}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
