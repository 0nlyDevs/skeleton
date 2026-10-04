"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const REASONS = ["spam", "harassment", "hate", "nudity", "violence", "other"] as const;

export type ReportTarget = "post" | "comment" | "message" | "user" | "page";

/** Report anything: pick a reason (one tap), optionally explain. */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly targetType: ReportTarget;
  readonly targetId: string;
}) {
  const t = useTranslation();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) {
      setHint(t("report.pick"));
      return;
    }
    setBusy(true);
    try {
      const label = t(`report.reason.${reason}` as MessageKey);
      await apiFetch("/api/reports", {
        method: "POST",
        body: { targetType, targetId, reason: details.trim() ? `${label}, ${details.trim()}` : label },
      });
      toast.success(t("report.sent"));
      onOpenChange(false);
      setReason(null);
      setDetails("");
    } catch (error) {
      setHint(error instanceof ApiRequestError && error.status === 409 ? t("report.duplicate") : describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("report.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-[0.8438rem] font-medium">{t("report.why")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("report.why")}>
          {REASONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={reason === value}
              onClick={() => {
                setReason(value);
                setHint(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
                reason === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-surface-muted",
              )}
            >
              {t(`report.reason.${value}` as MessageKey)}
            </button>
          ))}
        </div>
        <Textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder={t("report.details")}
          aria-label={t("report.details")}
          maxLength={800}
          rows={3}
        />
        {hint ? <p role="status" className="text-[0.7812rem] font-medium text-error">{hint}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t("report.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
