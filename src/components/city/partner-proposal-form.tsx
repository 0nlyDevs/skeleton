"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormGuard } from "@/hooks/use-form-guard";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";

const FIELDS = [
  { name: "organisation", required: true, max: 120 },
  { name: "contactName", required: true, max: 120 },
  { name: "email", required: true, max: 160, type: "email" },
  { name: "phone", required: false, max: 40, type: "tel" },
  { name: "serviceName", required: true, max: 120 },
  { name: "address", required: false, max: 200 },
  { name: "hours", required: false, max: 160 },
] as const;

/** F99 — a partner offers a service; the city answers before anything is shown to residents. */
export function PartnerProposalForm() {
  const t = useTranslation();
  const { guard, renew, trapField } = useFormGuard();
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reference, setReference] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string): string => String(form.get(name) ?? "").trim();
    setSending(true);
    setErrors({});
    try {
      const response = await apiFetch<{ data: { reference: string } }>("/api/partner-proposals", {
        method: "POST",
        body: {
          organisation: text("organisation"),
          contactName: text("contactName"),
          email: text("email"),
          phone: text("phone") || undefined,
          serviceName: text("serviceName"),
          summary: text("summary"),
          description: text("description"),
          address: text("address") || undefined,
          hours: text("hours") || undefined,
          guard: guard(),
        },
      });
      setReference(response.data.reference);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setErrors(error.fields);
      toast.error(describeApiError(error, t));
      renew();
    } finally {
      setSending(false);
    }
  };

  if (reference) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-success/10 p-5">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t("tn.partners.form.sent_title")}</p>
          <p className="text-sm">{t("tn.partners.form.sent_body", { reference })}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-4" noValidate>
      {trapField}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.name} className="flex flex-col gap-1.5">
            <Label htmlFor={`partner-${field.name}`}>
              {t(`tn.partners.form.${field.name}` as MessageKey)}
              {field.required ? null : <span className="font-normal text-muted-foreground"> · {t("tn.partners.form.optional")}</span>}
            </Label>
            <Input id={`partner-${field.name}`} name={field.name} type={"type" in field ? field.type : "text"} required={field.required} maxLength={field.max} aria-invalid={errors[field.name] ? true : undefined} />
            {errors[field.name] ? <p className="text-[0.8125rem] font-medium text-error">{errors[field.name]}</p> : null}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="partner-summary">{t("tn.partners.form.summary")}</Label>
        <Input id="partner-summary" name="summary" required maxLength={240} aria-invalid={errors.summary ? true : undefined} />
        {errors.summary ? <p className="text-[0.8125rem] font-medium text-error">{errors.summary}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="partner-description">{t("tn.partners.form.description")}</Label>
        <Textarea id="partner-description" name="description" required maxLength={2000} aria-invalid={errors.description ? true : undefined} />
        {errors.description ? <p className="text-[0.8125rem] font-medium text-error">{errors.description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={sending}>
          {sending ? <Spinner className="size-4" /> : <Send className="size-4" aria-hidden />}
          {t("tn.partners.form.send")}
        </Button>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.partners.form.note")}</p>
      </div>
    </form>
  );
}
