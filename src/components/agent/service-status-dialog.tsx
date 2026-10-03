"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { ServiceAvailabilityDto } from "@/modules/city-services/service-availability";

export interface StatusService {
  readonly slug: string;
  readonly name: string;
  readonly availability: ServiceAvailabilityDto;
}

const FIELD = "h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** `datetime-local` wants local wall-clock time without a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * F38 — report or update an interruption: what kind, what residents should
 * know, from when, until when, and where to go instead.
 */
export function ServiceStatusDialog({
  service,
  alternatives,
  open,
  onOpenChange,
  onSaved,
}: {
  readonly service: StatusService;
  readonly alternatives: readonly StatusService[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const t = useTranslation();
  const current = service.availability;
  const [kind, setKind] = useState<"MAINTENANCE" | "INCIDENT">(current.kind ?? "INCIDENT");
  const [note, setNote] = useState(current.note ?? "");
  const [from, setFrom] = useState(toLocalInput(current.from));
  const [until, setUntil] = useState(toLocalInput(current.until));
  const [alternative, setAlternative] = useState(current.alternative?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      await apiFetch(`/api/city-services/${encodeURIComponent(service.slug)}/availability`, {
        method: "PUT",
        body: JSON.stringify({
          availability: kind,
          note,
          unavailableFrom: from ? new Date(from).toISOString() : null,
          availableAgainAt: until ? new Date(until).toISOString() : null,
          alternativeSlug: alternative || null,
        }),
      });
      toast.success(t("tn.availability.saved"));
      onOpenChange(false);
      onSaved();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tn.availability.dialog.title", { service: service.name })}</DialogTitle>
          <DialogDescription>{t("tn.availability.dialog.body")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">{t("tn.availability.dialog.kind")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["INCIDENT", "MAINTENANCE"] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 text-sm",
                    kind === option ? "border-primary bg-accent" : "border-border hover:bg-surface-muted",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => setKind(option)} />
                    {t(option === "INCIDENT" ? "tn.availability.badge.incident" : "tn.availability.badge.maintenance")}
                  </span>
                  <span className="text-[0.7812rem] text-muted-foreground">
                    {t(option === "INCIDENT" ? "tn.availability.dialog.incident_hint" : "tn.availability.dialog.maintenance_hint")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="availability-note">{t("tn.availability.dialog.note")}</Label>
            <Textarea id="availability-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder={t("tn.availability.dialog.note_placeholder")} aria-invalid={fields.note ? true : undefined} />
            {fields.note ? <p className="text-[0.8125rem] text-error">{t("tn.availability.dialog.note_error")}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="availability-from">{t("tn.availability.dialog.from")}</Label>
              <Input id="availability-from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
              <p className="text-[0.75rem] text-muted-foreground">{t("tn.availability.dialog.from_hint")}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="availability-until">{t("tn.availability.dialog.until")}</Label>
              <Input id="availability-until" type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} aria-invalid={fields.availableAgainAt ? true : undefined} />
              <p className={cn("text-[0.75rem]", fields.availableAgainAt ? "text-error" : "text-muted-foreground")}>
                {fields.availableAgainAt ? t("tn.availability.dialog.until_error") : t("tn.availability.dialog.until_hint")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="availability-alternative">{t("tn.availability.dialog.alternative")}</Label>
            <select id="availability-alternative" value={alternative} onChange={(event) => setAlternative(event.target.value)} className={FIELD}>
              <option value="">{t("tn.availability.dialog.no_alternative")}</option>
              {alternatives.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("tn.availability.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
