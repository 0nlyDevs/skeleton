"use client";

import { Loader2, Lock, MapPin, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { LocationPicker, type PickedPlace } from "@/components/maps/location-picker";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ISSUE_TYPES, type IssueType } from "@/modules/city-requests/city-requests.schema";

const SELECT_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * The citizen's request form. On success it opens the request with its
 * confirmation. F25 — a request can instead report a problem in the city:
 * what kind, and where (a place in words and/or a point on the map).
 */
export function ContactForm({
  services,
  initialServiceId,
  initialKind = "question",
}: {
  readonly services: readonly { id: string; name: string }[];
  readonly initialServiceId: string;
  readonly initialKind?: "question" | "issue";
}) {
  const t = useTranslation();
  const router = useRouter();
  const [kind, setKind] = useState(initialKind);
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [location, setLocation] = useState("");
  const [point, setPoint] = useState<PickedPlace | null>(null);
  const [picking, setPicking] = useState(false);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const issue = kind === "issue";
  const issueReady = !issue || (issueType !== "" && (location.trim().length > 0 || point !== null));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      const response = await apiFetch<{ data: { reference: string } }>("/api/city-requests", {
        method: "POST",
        body: {
          serviceId: serviceId || null,
          subject: subject.trim(),
          message: message.trim(),
          ...(issue
            ? { issueType, location: location.trim() || null, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null }
            : {}),
        },
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("tn.contact.kind.label")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["question", "issue"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                kind === value ? "border-primary bg-accent font-medium" : "border-input hover:bg-surface-muted",
              )}
            >
              <input type="radio" name="contact-kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="accent-[var(--primary)]" />
              {t(`tn.contact.kind.${value}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>

      {issue ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-surface-muted/50 p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-issue-type">
              {t("tn.contact.issue.type")}
              <span className="text-error" aria-hidden>*</span>
            </Label>
            <select
              id="contact-issue-type"
              value={issueType}
              onChange={(event) => setIssueType(event.target.value as IssueType | "")}
              className={SELECT_CLASS}
              required
            >
              <option value="">{t("tn.contact.issue.choose")}</option>
              {ISSUE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`tn.issue.${value}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-location">
              {t("tn.contact.issue.location")}
              <span className="text-error" aria-hidden>*</span>
            </Label>
            <Input
              id="contact-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={t("tn.contact.issue.location_placeholder")}
              maxLength={200}
              aria-invalid={Boolean(fields.location)}
              aria-describedby={fields.location ? "contact-location-error" : undefined}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPicking(true)}>
                <MapPin aria-hidden />
                {t("tn.contact.issue.pick_map")}
              </Button>
              {point ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[0.8125rem] text-accent-foreground">
                  {t("tn.contact.issue.picked", { name: point.name })}
                  <button type="button" onClick={() => setPoint(null)} aria-label={t("tn.contact.issue.remove_point")} className="rounded-full p-0.5 hover:bg-background/60">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ) : null}
            </div>
            {fields.location ? <p id="contact-location-error" role="alert" className="text-[0.7812rem] text-error">{fields.location}</p> : null}
          </div>
          <LocationPicker open={picking} onOpenChange={setPicking} onPick={setPoint} />
        </div>
      ) : null}

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
        <p className="text-[0.7812rem] text-muted-foreground">{issue ? t("tn.contact.issue.service_hint") : t("tn.contact.service_hint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-subject">{t("tn.contact.subject")}</Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={issue ? t("tn.contact.issue.subject_placeholder") : t("tn.contact.subject_placeholder")}
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
          placeholder={issue ? t("tn.contact.issue.message_placeholder") : t("tn.contact.message_placeholder")}
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

      <Button type="submit" disabled={busy || subject.trim().length < 3 || message.trim().length < 10 || !issueReady} className="self-end">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {busy ? t("tn.contact.sending") : t("tn.contact.submit")}
      </Button>
    </form>
  );
}
