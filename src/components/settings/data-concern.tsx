"use client";

import { Loader2, ShieldQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

/**
 * F51 — "Signaler une inquiétude" about how one's data is used. It becomes a
 * request to the data-protection service: it gets a reference, an answer in
 * writing and a visible trail (state, steps, who answered when) like any other.
 */
export function DataConcernForm({ serviceId }: { readonly serviceId: string }) {
  const t = useTranslation();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      const { data } = await apiFetch<{ data: { reference: string } }>("/api/city-requests", {
        method: "POST",
        body: { serviceId, subject: subject.trim(), message: message.trim() },
      });
      router.push(`/space/requests/${data.reference}?sent=1`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 print:hidden" noValidate>
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldQuestion className="size-4" aria-hidden />
          {t("tn.concern.title")}
        </h2>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.concern.hint")}</p>
      </div>
      <div className="flex flex-col">
        <Label htmlFor="concern-subject">{t("tn.concern.subject")}</Label>
        <Input id="concern-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} required aria-invalid={Boolean(fields.subject)} placeholder={t("tn.concern.subject_hint")} />
        {fields.subject ? <p role="alert" className="mt-1 text-[0.8125rem] text-error">{fields.subject}</p> : null}
      </div>
      <div className="flex flex-col">
        <Label htmlFor="concern-message">{t("tn.concern.message")}</Label>
        <Textarea id="concern-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={2000} required aria-invalid={Boolean(fields.message)} />
        {fields.message ? <p role="alert" className="mt-1 text-[0.8125rem] text-error">{fields.message}</p> : null}
      </div>
      <Button type="submit" className="self-start" disabled={busy || subject.trim().length < 3 || message.trim().length < 10}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("tn.concern.send")}
      </Button>
    </form>
  );
}
