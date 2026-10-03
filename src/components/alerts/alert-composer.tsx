"use client";

import { Loader2, Siren } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SELECT_CLASS } from "@/components/agent/form-field";
import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import type { CityAlertDto } from "@/modules/alerts/alerts.service";
import {
  type CITY_ALERT_SCOPES,
  CITY_ALERT_SEVERITIES,
  CITY_REGION_IDS,
  CITY_ZONES,
  CITY_ZONE_VERTICES,
  alertTargetsZone,
  cityAlertScopeLabelKey,
  cityZoneLabelKey,
} from "@/modules/alerts/city-zones";

export function AlertComposer() {
  const t = useTranslation();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<(typeof CITY_ALERT_SCOPES)[number]>("ALL");
  const [severity, setSeverity] = useState<(typeof CITY_ALERT_SEVERITIES)[number]>("WARNING");
  const [busy, setBusy] = useState(false);
  const [reach, setReach] = useState<number | null>(null);

  // Before publishing, the agent sees exactly who will be notified.
  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ data: { residents: number } }>(`/api/alerts/reach?scope=${scope}`)
      .then((response) => {
        if (!cancelled) setReach(response.data.residents);
      })
      .catch(() => {
        if (!cancelled) setReach(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await apiFetch<{ data: CityAlertDto }>("/api/alerts", {
        method: "POST",
        body: { title, summary, body, scope, severity },
      });
      toast.success(t("alerts.form.published"));
      router.replace(`/alerts/${encodeURIComponent(response.data.slug)}`);
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
      setBusy(false);
    }
  };

  const scopeLabel = (value: (typeof CITY_ALERT_SCOPES)[number]) => t(cityAlertScopeLabelKey(value));

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-5 shadow-panel sm:p-6" noValidate>
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Siren aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("alerts.create")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("alerts.form.subtitle")}</p>
        </div>
      </header>

      <FormField label={t("alerts.form.title")} required>
        {({ id, ...props }) => <Input {...props} id={id} value={title} onChange={(event) => setTitle(event.target.value)} minLength={6} maxLength={160} autoFocus required />}
      </FormField>
      <FormField label={t("alerts.form.summary")} required>
        {({ id, ...props }) => <Input {...props} id={id} value={summary} onChange={(event) => setSummary(event.target.value)} minLength={10} maxLength={300} required />}
      </FormField>
      <FormField label={t("alerts.form.body")} required>
        {({ id, ...props }) => <Textarea {...props} id={id} value={body} onChange={(event) => setBody(event.target.value)} minLength={10} maxLength={8000} rows={7} required />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("alerts.form.scope")} hint={t("alerts.form.scope_hint")}>
          {({ id, ...props }) => (
            <select {...props} id={id} value={scope} onChange={(event) => setScope(event.target.value as (typeof CITY_ALERT_SCOPES)[number])} className={SELECT_CLASS}>
              <option value="ALL">{scopeLabel("ALL")}</option>
              <optgroup label={t("alerts.form.region_group")}>
                {CITY_REGION_IDS.map((region) => <option key={region} value={region}>{scopeLabel(region)}</option>)}
              </optgroup>
              <optgroup label={t("alerts.form.zone_group")}>
                {CITY_ZONES.map((zone) => <option key={zone.id} value={zone.id}>{scopeLabel(zone.id)}</option>)}
              </optgroup>
            </select>
          )}
        </FormField>
        <FormField label={t("alerts.form.severity")}>
          {({ id, ...props }) => (
            <select {...props} id={id} value={severity} onChange={(event) => setSeverity(event.target.value as (typeof CITY_ALERT_SEVERITIES)[number])} className={SELECT_CLASS}>
              {CITY_ALERT_SEVERITIES.map((level) => <option key={level} value={level}>{t(`alerts.severity.${level}` as MessageKey)}</option>)}
            </select>
          )}
        </FormField>
      </div>

      <div className="grid items-center gap-4 rounded-2xl border border-border/60 bg-surface-muted/50 p-3 sm:grid-cols-[220px_1fr]">
        <svg viewBox="60 80 870 480" className="w-full" role="img" aria-label={scopeLabel(scope)}>
          {CITY_ZONES.map((zone) => {
            const points = zone.polygon.map((key) => CITY_ZONE_VERTICES[key]);
            const targeted = alertTargetsZone(scope, zone.id);
            return (
              <polygon
                key={zone.id}
                points={points.map((point) => point.join(",")).join(" ")}
                className={targeted ? (severity === "CRITICAL" ? "fill-error/70" : severity === "WARNING" ? "fill-warning/70" : "fill-primary/60") : "fill-foreground/10"}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={3}
              >
                <title>{t(cityZoneLabelKey(zone.id))}</title>
              </polygon>
            );
          })}
        </svg>
        <div className="flex flex-col gap-1 text-[0.875rem]">
          <p className="font-semibold">{scopeLabel(scope)}</p>
          <p className="text-muted-foreground" aria-live="polite">
            {reach === null ? "…" : t("alerts.reach", { count: reach })}
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">{t("alerts.form.scope_hint")}</p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <Button asChild type="button" variant="ghost"><Link href="/alerts">{t("common.cancel")}</Link></Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Siren aria-hidden />}
          {busy ? t("alerts.form.saving") : t("alerts.form.publish")}
        </Button>
      </footer>
    </form>
  );
}
