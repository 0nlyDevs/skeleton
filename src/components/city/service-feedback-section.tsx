"use client";

import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import type { ServiceSatisfactionDto } from "@/modules/service-feedback/service-feedback.service";

import { FeedbackForm } from "./feedback-form";

/**
 * F76 — on a service page: how residents rate it overall, and one button to
 * say how it went. Comments themselves stay between the resident and the city.
 */
export function ServiceFeedbackSection({
  serviceSlug,
  serviceName,
  signedIn,
  summary,
}: {
  readonly serviceSlug: string;
  readonly serviceName: string;
  readonly signedIn: boolean;
  readonly summary: ServiceSatisfactionDto;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section id="feedback" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5" aria-labelledby="feedback-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="feedback-title" className="font-semibold">{t("tn.feedback.section_title")}</h2>
          <p className="text-[0.8438rem] text-muted-foreground">
            {summary.count > 0 && summary.average !== null && summary.satisfied !== null
              ? t("tn.feedback.summary", { percent: summary.satisfied, count: summary.count, average: String(summary.average).replace(".", ",") })
              : t("tn.feedback.summary_empty")}
          </p>
        </div>
        {!open ? (
          signedIn ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
              {t("tn.feedback.open")}
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/login?next=${encodeURIComponent(`/services/${serviceSlug}#feedback`)}`}>{t("tn.feedback.sign_in")}</Link>
            </Button>
          )
        ) : null}
      </div>
      {open ? <FeedbackForm serviceSlug={serviceSlug} serviceName={serviceName} /> : null}
    </section>
  );
}
