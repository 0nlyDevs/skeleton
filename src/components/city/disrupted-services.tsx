"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import type { ServiceDto } from "@/modules/city-services/city-services.service";

import { ServiceAvailabilityNotice } from "./service-availability-notice";

/**
 * F38 — at the top of the services list: every service that is stopped or
 * about to be, so a resident knows before opening one.
 */
export function DisruptedServices({ services }: { readonly services: readonly ServiceDto[] }) {
  const t = useTranslation();
  if (services.length === 0) return null;
  return (
    <section aria-labelledby="disrupted-services" className="flex flex-col gap-2.5">
      <h2 id="disrupted-services" className="px-1 text-[0.8125rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("tn.availability.disrupted_title")}
      </h2>
      {services.map((service) => (
        <ServiceAvailabilityNotice key={service.slug} availability={service.availability} serviceName={service.name} serviceSlug={service.slug} />
      ))}
    </section>
  );
}
