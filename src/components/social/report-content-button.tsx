"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";

export type ReportableContentType = "post" | "comment" | "message" | "user";

export function ReportContentButton({
  targetType,
  targetId,
  signedIn,
  label,
  compact = false,
}: {
  readonly targetType: ReportableContentType;
  readonly targetId: string;
  readonly signedIn: boolean;
  readonly label: string;
  readonly compact?: boolean;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <Button asChild variant="ghost" size="sm" className={compact ? "size-8 p-0" : undefined}>
        <Link href="/login" aria-label={label} title={label}>
          <Flag />
          {!compact ? label : null}
        </Link>
      </Button>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanReason = reason.trim();
    if (cleanReason.length < 5 || busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: { targetType, targetId, reason: cleanReason },
      });
      toast.success(t("posts.report.success"));
      setReason("");
      setOpen(false);
    } catch {
      toast.error(t("posts.report.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={compact ? "size-8 p-0" : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
      >
        <Flag />
        {!compact ? label : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("posts.report.title")}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("posts.report.reason_placeholder")}
              aria-label={t("posts.report.reason")}
              minLength={5}
              maxLength={1000}
              required
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("posts.report.cancel")}
              </Button>
              <Button type="submit" disabled={busy || reason.trim().length < 5}>
                {t("posts.report.title")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
