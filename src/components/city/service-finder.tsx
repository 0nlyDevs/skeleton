"use client";

import { ArrowRight, Loader2, Phone, Search, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { EMERGENCY_PHONE } from "@/modules/city-requests/city-requests.emergency";
import type { OrientationDto } from "@/modules/orientation/orientation.service";

/**
 * D10/F91/F92 — "De quoi avez-vous besoin ?": one field, in the resident's
 * own words, spelling mistakes included. The answer is one sentence and up to
 * three services; when nothing fits, a request to the city is offered, which
 * an agent routes.
 */
export function ServiceFinder({ autoFocus = false }: { readonly autoFocus?: boolean }) {
  const t = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OrientationDto | null>(null);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      setResult((await apiFetch<{ data: OrientationDto }>("/api/orient", { method: "POST", body: { text: text.trim() } })).data);
    } catch (failure) {
      setError(describeApiError(failure, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="finder-title" className="flex flex-col gap-3">
      <h2 id="finder-title" className="px-1 text-lg font-semibold">{t("tn.finder.title")}</h2>
      <form onSubmit={(event) => void submit(event)} role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={400}
            autoFocus={autoFocus}
            aria-label={t("tn.finder.title")}
            placeholder={t("tn.finder.placeholder")}
            className="h-12 w-full rounded-full bg-card pl-11 pr-4 text-[0.9375rem] shadow-panel outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
        <Button type="submit" size="lg" disabled={busy || text.trim().length < 2}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("tn.finder.go")}
        </Button>
      </form>

      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}

      {result ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          {result.urgent ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-error/50 bg-error/10 p-4">
              <p className="flex-1 font-semibold text-error">{t("tn.emergency.title")}</p>
              <a href={`tel:${EMERGENCY_PHONE.replace(/\s+/g, "")}`} className="inline-flex items-center gap-2 rounded-full bg-error px-4 py-2 text-sm font-semibold text-error-foreground">
                <Phone className="size-4" aria-hidden />
                {t("tn.emergency.call", { phone: EMERGENCY_PHONE })}
              </a>
            </div>
          ) : null}
          {result.explanation ? <p className="rounded-2xl bg-card p-4 text-[0.9375rem] shadow-panel">{result.explanation}</p> : <p className="rounded-2xl bg-card p-4 text-[0.9375rem] shadow-panel">{t("tn.finder.none")}</p>}
          {result.matches.length > 0 && result.explanation ? (
            <ul className="grid gap-3 sm:grid-cols-3">
              {result.matches.map((match, index) => (
                <li key={match.slug}>
                  <Link href={`/services/${match.slug}`} className="flex h-full flex-col gap-1.5 rounded-2xl bg-card p-4 shadow-panel hover:bg-accent">
                    {index === 0 ? <span className="w-fit rounded-full bg-foreground px-2.5 py-0.5 text-[0.6875rem] font-semibold text-background">{t("tn.finder.best")}</span> : null}
                    <span className="flex items-center gap-1.5 font-semibold">
                      {match.name}
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                    <span className="line-clamp-2 text-[0.8125rem] text-muted-foreground">{match.summary}</span>
                    {match.unavailable ? <span className="text-[0.75rem] font-medium text-warning">{t("tn.finder.unavailable")}</span> : match.openNow !== null ? <span className="text-[0.75rem] text-muted-foreground">{match.openNow ? t("tn.hours.open") : t("tn.hours.closed")}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {result.suggestRequest || result.matches.length > 0 ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm">
              <span className="text-muted-foreground">{t("tn.finder.not_it")}</span>
              <Link href="/contact" className="inline-flex items-center gap-1.5 font-medium text-primary">
                <Send className="size-3.5" aria-hidden />
                {t("tn.finder.send_request")}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
