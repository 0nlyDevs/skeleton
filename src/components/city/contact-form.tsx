"use client";

import { Loader2, Lock, Send } from "lucide-react";
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

const SELECT_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** The citizen's request form. On success it opens the request with its confirmation. */
export function ContactForm({
  services,
  initialServiceId,
}: {
  readonly services: readonly { id: string; name: string }[];
  readonly initialServiceId: string;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      const response = await apiFetch<{ data: { reference: string } }>("/api/city-requests", {
        method: "POST",
        body: { serviceId: serviceId || null, subject: subject.trim(), message: message.trim() },
      });
      router.push(`/space/requests/${response.data.reference}?sent=1`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-service">{t("tn.contact.service")}</Label>
        <select id="contact-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={SELECT_CLASS}>
          <option value="">{t("tn.no_service")}</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
        <p className="text-[0.7812rem] text-muted-foreground">{t("tn.contact.service_hint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-subject">{t("tn.contact.subject")}</Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={t("tn.contact.subject_placeholder")}
          maxLength={160}
          required
          aria-invalid={Boolean(fields.subject)}
          aria-describedby={fields.subject ? "contact-subject-error" : undefined}
        />
        {fields.subject ? <p id="contact-subject-error" role="alert" className="text-[0.7812rem] text-error">{fields.subject}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-message">{t("tn.contact.message")}</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("tn.contact.message_placeholder")}
          rows={7}
          maxLength={5000}
          required
          aria-invalid={Boolean(fields.message)}
          aria-describedby={fields.message ? "contact-message-error" : undefined}
        />
        <div className="flex justify-between gap-2 text-[0.7812rem]">
          <span className="text-error" id="contact-message-error" role="alert">{fields.message ?? ""}</span>
          <span className="text-muted-foreground">{message.length}/5000</span>
        </div>
      </div>

      <p className="flex items-start gap-2 text-[0.7812rem] text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("tn.contact.privacy")}
      </p>

      <Button type="submit" disabled={busy || subject.trim().length < 3 || message.trim().length < 10} className="self-end">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {busy ? t("tn.contact.sending") : t("tn.contact.submit")}
      </Button>
    </form>
  );
}
