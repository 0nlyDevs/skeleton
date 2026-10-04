"use client";

import { Loader2, Lock, MapPin, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Term } from "@/components/ui/term";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { zoneAt } from "@/modules/alerts/city-zones";
import type { ServiceAvailabilityDto } from "@/modules/city-services/service-availability";
import type { ReportDto } from "@/modules/city-requests/city-requests.reports";
import { ISSUE_TYPES, type IssueType } from "@/modules/city-requests/city-requests.schema";

import { ServiceAvailabilityNotice } from "./service-availability-notice";
import { TerraNovaPicker, type PickedPoint } from "./terra-nova-picker";

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
  initialSubject = "",
}: {
  readonly services: readonly { id: string; name: string; availability: ServiceAvailabilityDto }[];
  readonly initialServiceId: string;
  readonly initialKind?: "question" | "issue";
  /** Prefilled subject, e.g. when coming from the accessibility page. */
  readonly initialSubject?: string;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [kind, setKind] = useState(initialKind);
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [location, setLocation] = useState("");
  const [point, setPoint] = useState<PickedPoint | null>(null);
  const [picking, setPicking] = useState(false);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  // F52 — before sending a new report, show the open ones already nearby.
  const [similar, setSimilar] = useState<ReportDto[]>([]);
  const [similarDismissed, setSimilarDismissed] = useState(false);
  const [supportingRef, setSupportingRef] = useState<string | null>(null);

  const applyTemplate = (template: "arrival" | "transport" | "issue" | "question") => {
    if (template === "issue") setKind("issue");
    setSubject(t(`tn.hints.preset.${template}.subject` as MessageKey));
    setMessage(t(`tn.hints.preset.${template}.message` as MessageKey));
  };

  const issue = kind === "issue";

  useEffect(() => {
    if (kind !== "issue" || issueType === "") {
      setSimilar([]);
      return;
    }
    const zone = point ? zoneAt(point.mapX, point.mapY) : null;
    const params = new URLSearchParams({ issueType });
    if (zone) params.set("zone", zone);
    const controller = new AbortController();
    apiFetch<{ data: ReportDto[] }>(`/api/city-reports/similar?${params.toString()}`, { signal: controller.signal })
      .then((response) => setSimilar(response.data))
      .catch(() => undefined);
    return () => controller.abort();
  }, [kind, issueType, point]);

  const supportSimilar = async (reference: string) => {
    setSupportingRef(reference);
    try {
      await apiFetch(`/api/city-requests/${reference}/support`, { method: "POST" });
      toast.success(t("tn.reports.support_thanks"));
      setSimilar((current) =>
        current.map((report) => (report.reference === reference ? { ...report, supportCount: report.supportCount + 1, supportedAt: new Date().toISOString() } : report)),
      );
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setSupportingRef(null);
    }
  };
  const selectedService = services.find((service) => service.id === serviceId);
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
            ? { issueType, location: location.trim() || null, mapX: point?.mapX ?? null, mapY: point?.mapY ?? null }
            : {}),
        },
      });
      router.push(`/space/requests/${response.data.reference}?sent=1`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        setFields(error.fields);
        // F42 — move to the first field to fix, so keyboard and screen reader users land on it.
        const first = ["location", "subject", "message"].find((key) => error.fields?.[key]);
        if (first) requestAnimationFrame(() => document.getElementById(`contact-${first}`)?.focus());
      }
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

      <aside className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-accent/40 p-3" aria-label={t("tn.hints.title")}>
        <p className="text-sm font-medium">{t("tn.hints.contact_tip")}</p>
        <div className="flex flex-wrap gap-2">
          {(["arrival", "transport", "issue", "question"] as const).map((template) => (
            <Button key={template} type="button" variant="secondary" size="sm" onClick={() => applyTemplate(template)}>
              {t(`tn.hints.template.${template}` as MessageKey)}
            </Button>
          ))}
        </div>
      </aside>

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
          <TerraNovaPicker open={picking} onOpenChange={setPicking} onPick={setPoint} />
          {similar.length > 0 && !similarDismissed ? (
            <aside className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-accent/40 p-3" aria-label={t("tn.contact.similar_title")}>
              <p className="text-sm font-medium">{t("tn.contact.similar_title")}</p>
              <p className="text-[0.8125rem] text-muted-foreground">{t("tn.contact.similar_body")}</p>
              <ul className="flex flex-col gap-2">
                {similar.map((report) => (
                  <li key={report.reference} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[0.8438rem]">
                      {report.subject} · {t("tn.reports.count", { count: report.supportCount })}
                    </span>
                    {report.supportedAt ? (
                      <span className="text-[0.75rem] text-success">{t("tn.reports.support_thanks")}</span>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled={supportingRef === report.reference} onClick={() => void supportSimilar(report.reference)}>
                        {t("tn.reports.support")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" className="self-start text-[0.8125rem] text-muted-foreground hover:underline" onClick={() => setSimilarDismissed(true)}>
                {t("tn.contact.similar_continue")}
              </button>
            </aside>
          ) : null}
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
        {/* F38 — said before the resident writes, not after they send. */}
        {selectedService ? <ServiceAvailabilityNotice availability={selectedService.availability} serviceName={selectedService.name} className="mt-1" /> : null}
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
        <span>
          {t("tn.contact.privacy")} <Term id="encrypted">{t("tn.contact.privacy_term")}</Term>
        </span>
      </p>

      <Button type="submit" disabled={busy || subject.trim().length < 3 || message.trim().length < 10 || !issueReady} className="self-end">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {busy ? t("tn.contact.sending") : t("tn.contact.submit")}
      </Button>
    </form>
  );
}
