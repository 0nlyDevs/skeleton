"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatDateTime } from "@/lib/format";
import type { PartnerProposalDto } from "@/modules/partner-proposals/partner-proposals.service";

/** F99 — staff read each partner proposal and accept it into the catalogue, or decline with a reason. */
export function PartnerProposalsPanel() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<PartnerProposalDto[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await apiFetch<{ data: PartnerProposalDto[] }>("/api/partner-proposals")).data);
    } catch (error) {
      toast.error(describeApiError(error, t));
      setItems([]);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: "accept" | "decline") => {
    setBusy(id);
    try {
      const response = await apiFetch<{ data: PartnerProposalDto }>(`/api/partner-proposals/${id}`, { method: "PATCH", body: { decision, answer: answers[id]?.trim() || undefined } });
      setItems((current) => current?.map((item) => (item.id === id ? response.data : item)) ?? null);
      toast.success(t(decision === "accept" ? "tn.partners.admin.accepted" : "tn.partners.admin.declined"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  if (items === null) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (items.length === 0) return <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("tn.partners.admin.empty")}</p>;

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{item.serviceName}</h2>
              <p className="text-sm text-muted-foreground">
                {item.organisation} · {item.reference} · {formatDateTime(item.createdAt, locale)}
              </p>
            </div>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[0.75rem] font-semibold">{t(`tn.partners.admin.status.${item.status}`)}</span>
          </div>
          <p className="text-sm font-medium">{item.summary}</p>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{item.description}</p>
          <p className="text-[0.8125rem] text-muted-foreground">
            {[item.contactName, item.email, item.phone, item.address, item.hours].filter(Boolean).join(" · ")}
          </p>
          {item.status === "PENDING" ? (
            <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center">
              <Input
                aria-label={t("tn.partners.admin.answer")}
                placeholder={t("tn.partners.admin.answer")}
                maxLength={300}
                value={answers[item.id] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
              />
              <div className="flex shrink-0 gap-2">
                <Button type="button" disabled={busy === item.id} onClick={() => void decide(item.id, "accept")}>
                  <Check className="size-4" aria-hidden />
                  {t("tn.partners.admin.accept")}
                </Button>
                <Button type="button" variant="outline" disabled={busy === item.id} onClick={() => void decide(item.id, "decline")}>
                  <X className="size-4" aria-hidden />
                  {t("tn.partners.admin.decline")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="border-t border-border/70 pt-3 text-sm">
              {item.answer ? `${item.answer} ` : null}
              {item.serviceSlug ? (
                <Link href={`/services/${item.serviceSlug}`} className="font-medium underline">
                  {t("tn.partners.admin.see_service")}
                </Link>
              ) : null}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
