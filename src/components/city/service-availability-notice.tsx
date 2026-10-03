"use client";

import { CalendarClock, Construction, Phone, TriangleAlert } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { useFormatters } from "@/hooks/use-formatters";
import { cn } from "@/lib/utils";
import type { ServiceAvailabilityDto } from "@/modules/city-services/service-availability";

const TONE = {
  PLANNED: { box: "border-primary/30 bg-accent/60", icon: "text-primary", Icon: CalendarClock },
  MAINTENANCE: { box: "border-warning/40 bg-warning/10", icon: "text-warning", Icon: Construction },
  INCIDENT: { box: "border-error/40 bg-error/10", icon: "text-error", Icon: TriangleAlert },
} as const;

/**
 * F38 — shown before a resident starts a procedure: is the service stopped,
 * since when and until when, what to do instead, and whether a request can
 * still be sent. Dates are formatted in the reader's own time zone.
 */
export function ServiceAvailabilityNotice({
  availability,
  serviceName,
  serviceSlug,
  className,
}: {
  readonly availability: ServiceAvailabilityDto;
  readonly serviceName?: string;
  /** Links the name to the service page (lists of several services). */
  readonly serviceSlug?: string;
  readonly className?: string;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  if (availability.state === "AVAILABLE") return null;
  const tone = TONE[availability.state];

  const title =
    availability.state === "PLANNED"
      ? t("tn.availability.title.planned")
      : t(availability.state === "INCIDENT" ? "tn.availability.title.incident" : "tn.availability.title.maintenance");

  let when: string;
  if (availability.state === "PLANNED" && availability.from) {
    when = availability.until
      ? t("tn.availability.when.planned_range", { from: fmt.dateTime(availability.from), until: fmt.dateTime(availability.until) })
      : t("tn.availability.when.planned_from", { from: fmt.dateTime(availability.from) });
  } else if (availability.late) {
    when = t("tn.availability.when.late");
  } else if (availability.until) {
    when = t(availability.kind === "INCIDENT" ? "tn.availability.when.estimate" : "tn.availability.when.until", { until: fmt.dateTime(availability.until) });
  } else {
    when = t("tn.availability.when.unknown");
  }

  return (
    <section role="status" aria-label={serviceName ? `${title} — ${serviceName}` : title} className={cn("flex gap-3 rounded-2xl border p-4", tone.box, className)}>
      <tone.Icon className={cn("mt-0.5 size-5 shrink-0", tone.icon)} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1.5 text-[0.9062rem]">
        <p className="font-semibold">
          {title}
          {serviceName ? (
            <span className="font-normal text-muted-foreground">
              {" · "}
              {serviceSlug ? (
                <Link href={`/services/${encodeURIComponent(serviceSlug)}`} className="font-medium text-foreground underline underline-offset-2">
                  {serviceName}
                </Link>
              ) : (
                serviceName
              )}
            </span>
          ) : null}
        </p>
        {availability.note ? <p className="leading-relaxed">{availability.note}</p> : null}
        <p className="font-medium">{when}</p>
        {availability.alternative ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {t("tn.availability.instead")}{" "}
              <Link href={`/services/${encodeURIComponent(availability.alternative.slug)}`} className="font-medium text-primary underline underline-offset-2">
                {availability.alternative.name}
              </Link>
            </span>
            {availability.alternative.phone ? (
              <a href={`tel:${availability.alternative.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 font-medium text-primary">
                <Phone className="size-3.5" aria-hidden />
                {availability.alternative.phone}
              </a>
            ) : null}
          </p>
        ) : null}
        {availability.state !== "PLANNED" ? <p className="text-[0.8438rem] text-muted-foreground">{t("tn.availability.request_still")}</p> : null}
      </div>
    </section>
  );
}

/** One word on a service card: "Maintenance", "Incident" or "Travaux prévus". */
export function ServiceAvailabilityBadge({ availability }: { readonly availability: ServiceAvailabilityDto }) {
  const t = useTranslation();
  if (availability.state === "AVAILABLE") return null;
  const tone =
    availability.state === "INCIDENT"
      ? "border-error/30 bg-error/10 text-error"
      : availability.state === "MAINTENANCE"
        ? "border-warning/30 bg-warning/14 text-warning"
        : "border-primary/30 bg-accent text-primary";
  const label =
    availability.state === "PLANNED"
      ? t("tn.availability.badge.planned")
      : t(availability.state === "INCIDENT" ? "tn.availability.badge.incident" : "tn.availability.badge.maintenance");
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold", tone)}>{label}</span>;
}
