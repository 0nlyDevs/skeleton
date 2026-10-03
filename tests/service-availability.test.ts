/**
 * F38 — what a resident is told about a service's availability. The rules
 * that matter: planned work shows as announced until it starts and ends by
 * itself, an incident stays until an agent closes it, and staff cannot
 * publish a stop without saying why.
 */

import { describe, expect, it } from "vitest";

import { serviceAvailabilityInputSchema } from "@/modules/city-services/city-services.schema";
import { availabilityOf, isStopped, type AvailabilityRecord } from "@/modules/city-services/service-availability";

const NOW = new Date("2026-10-03T12:00:00Z");
const hours = (offset: number) => new Date(NOW.getTime() + offset * 3_600_000);
const record = (patch: Partial<AvailabilityRecord>): AvailabilityRecord => ({
  availability: "MAINTENANCE",
  availabilityNote: "Mise à jour des serveurs.",
  unavailableFrom: null,
  availableAgainAt: null,
  ...patch,
});

describe("availabilityOf", () => {
  it("reports a normal service as available", () => {
    expect(availabilityOf(record({ availability: "AVAILABLE" }), null, NOW).state).toBe("AVAILABLE");
  });

  it("announces planned work that has not started, without stopping the service", () => {
    const state = availabilityOf(record({ unavailableFrom: hours(24), availableAgainAt: hours(30) }), null, NOW);
    expect(state.state).toBe("PLANNED");
    expect(isStopped(state)).toBe(false);
  });

  it("stops the service while the work runs", () => {
    const state = availabilityOf(record({ unavailableFrom: hours(-1), availableAgainAt: hours(3) }), null, NOW);
    expect(state.state).toBe("MAINTENANCE");
    expect(state.until).toBe(hours(3).toISOString());
  });

  it("brings planned work back by itself once its end time passes", () => {
    expect(availabilityOf(record({ unavailableFrom: hours(-5), availableAgainAt: hours(-1) }), null, NOW).state).toBe("AVAILABLE");
  });

  it("keeps an incident open past its estimate, and says it is late", () => {
    const state = availabilityOf(record({ availability: "INCIDENT", availableAgainAt: hours(-1) }), null, NOW);
    expect(state.state).toBe("INCIDENT");
    expect(state.late).toBe(true);
  });

  it("passes the alternative along", () => {
    const alternative = { slug: "sante", name: "Centre de santé", phone: "112" };
    expect(availabilityOf(record({ availability: "INCIDENT" }), alternative, NOW).alternative).toEqual(alternative);
  });
});

describe("serviceAvailabilityInputSchema", () => {
  it("refuses a stop without an explanation", () => {
    expect(serviceAvailabilityInputSchema.safeParse({ availability: "INCIDENT", note: "Panne" }).success).toBe(false);
  });

  it("refuses a return before the start", () => {
    const parsed = serviceAvailabilityInputSchema.safeParse({
      availability: "MAINTENANCE",
      note: "Travaux sur le réseau d'eau.",
      unavailableFrom: "2026-10-04T10:00:00.000Z",
      availableAgainAt: "2026-10-04T08:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts closing an interruption with nothing else", () => {
    expect(serviceAvailabilityInputSchema.safeParse({ availability: "AVAILABLE" }).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(serviceAvailabilityInputSchema.safeParse({ availability: "AVAILABLE", active: false }).success).toBe(false);
  });
});
