/**
 * F38 — whether a municipal service can be used right now.
 *
 * Staff record an interruption once (kind, message, start, expected return,
 * alternative); what a resident sees is derived from it at read time, so a
 * planned maintenance shows as "announced" until it starts and disappears by
 * itself when its end time passes. An incident has no reliable end: it stays
 * until an agent closes it, and a passed return time reads as "late".
 */

export type AvailabilityKind = "MAINTENANCE" | "INCIDENT";

/** What the resident is told. */
export type AvailabilityState =
  | "AVAILABLE"
  /** Works today; an interruption is announced. */
  | "PLANNED"
  | "MAINTENANCE"
  | "INCIDENT";

export interface ServiceAvailabilityDto {
  readonly state: AvailabilityState;
  readonly kind: AvailabilityKind | null;
  readonly note: string | null;
  readonly from: string | null;
  readonly until: string | null;
  /** The expected return time has passed and the service is still stopped. */
  readonly late: boolean;
  readonly alternative: { readonly slug: string; readonly name: string; readonly phone: string | null } | null;
}

export interface AvailabilityRecord {
  readonly availability: "AVAILABLE" | AvailabilityKind;
  readonly availabilityNote: string | null;
  readonly unavailableFrom: Date | null;
  readonly availableAgainAt: Date | null;
}

export const AVAILABLE: ServiceAvailabilityDto = {
  state: "AVAILABLE",
  kind: null,
  note: null,
  from: null,
  until: null,
  late: false,
  alternative: null,
};

export function availabilityOf(
  record: AvailabilityRecord,
  alternative: ServiceAvailabilityDto["alternative"],
  now: Date = new Date(),
): ServiceAvailabilityDto {
  if (record.availability === "AVAILABLE") return AVAILABLE;
  const kind = record.availability;
  const from = record.unavailableFrom;
  const until = record.availableAgainAt;

  // Planned work that is over: back to normal without anyone touching it.
  if (kind === "MAINTENANCE" && until && until.getTime() <= now.getTime()) return AVAILABLE;

  const planned = from !== null && from.getTime() > now.getTime();
  return {
    state: planned ? "PLANNED" : kind,
    kind,
    note: record.availabilityNote,
    from: from?.toISOString() ?? null,
    until: until?.toISOString() ?? null,
    late: !planned && kind === "INCIDENT" && until !== null && until.getTime() <= now.getTime(),
    alternative,
  };
}

/** Stopped right now (planned work that has not started does not count). */
export function isStopped(availability: ServiceAvailabilityDto): boolean {
  return availability.state === "MAINTENANCE" || availability.state === "INCIDENT";
}
