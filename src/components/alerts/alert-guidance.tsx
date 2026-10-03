"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { CityZoneId } from "@/modules/alerts/city-zones";

interface GuidanceResponse {
  readonly text: string;
  readonly source: "ai" | "general";
  readonly zone: CityZoneId;
}

export function AlertGuidance({
  slug,
  viewerZone,
  authenticated,
}: {
  readonly slug: string;
  readonly viewerZone: CityZoneId | null;
  readonly authenticated: boolean;
}) {
  const t = useTranslation();
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (busy || !viewerZone) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<{ data: GuidanceResponse }>(`/api/alerts/${encodeURIComponent(slug)}/recommendations`, { method: "POST" });
      setGuidance(response.data);
    } catch (caught) {
      setError(describeApiError(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles aria-hidden /></span>
        <div>
          <h2 className="font-semibold">{t("alerts.guidance.title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("alerts.guidance.body")}</p>
        </div>
      </div>
      {!authenticated ? (
        <Alert><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>{t("alerts.guidance.signin")}</span><Button asChild size="sm"><Link href="/login">{t("nav.sign_in")}</Link></Button></AlertDescription></Alert>
      ) : !viewerZone ? (
        <Alert><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>{t("alerts.guidance.location")}</span><Button asChild size="sm" variant="secondary"><Link href="/settings/profile">{t("alerts.location.label")}</Link></Button></AlertDescription></Alert>
      ) : (
        <>
          {guidance ? (
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(guidance.source === "ai" ? "alerts.guidance.ai" : "alerts.guidance.general")}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed">{guidance.text}</p>
            </div>
          ) : (
            <Button className="self-start" variant="secondary" onClick={() => void generate()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {busy ? t("alerts.guidance.loading") : t("alerts.guidance.generate")}
            </Button>
          )}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </>
      )}
    </section>
  );
}
