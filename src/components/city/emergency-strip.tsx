import { Ambulance, Map as MapIcon, Phone } from "lucide-react";

import Link from "@/components/ui/link";

export interface EmergencyEntry {
  readonly slug: string;
  readonly name: string;
  readonly zone: string;
  readonly hours: string | null;
  readonly phone: string | null;
}

/**
 * Hospitals and rescue, first on the services page: who to call and where
 * they are, without opening anything else.
 */
export function EmergencyStrip({
  entries,
  labels,
}: {
  readonly entries: readonly EmergencyEntry[];
  readonly labels: { readonly title: string; readonly body: string; readonly call: string; readonly map: string };
}) {
  if (entries.length === 0) return null;
  return (
    <section className="rounded-2xl border border-error/30 bg-error/5 p-4" aria-labelledby="emergency-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="emergency-title" className="flex items-center gap-2 font-semibold text-error">
            <Ambulance className="size-5" aria-hidden />
            {labels.title}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{labels.body}</p>
        </div>
        <Link href="/city-map?layer=emergency" className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline">
          <MapIcon className="size-4" aria-hidden />
          {labels.map}
        </Link>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <li key={entry.slug} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2">
            <Link href={`/services/${entry.slug}`} className="min-w-0 flex-1">
              <span className="block truncate text-[0.875rem] font-semibold hover:underline">{entry.name}</span>
              <span className="block truncate text-[0.75rem] text-muted-foreground">
                {entry.zone}
                {entry.hours ? ` · ${entry.hours}` : ""}
              </span>
            </Link>
            {entry.phone ? (
              <a
                href={`tel:${entry.phone.replace(/\s+/g, "")}`}
                className="flex shrink-0 items-center gap-1 rounded-full bg-error px-3 py-1.5 text-[0.75rem] font-semibold text-error-foreground"
                aria-label={`${labels.call} ${entry.name}`}
              >
                <Phone className="size-3.5" aria-hidden />
                {labels.call}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
