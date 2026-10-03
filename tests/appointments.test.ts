/**
 * F39/F40 — appointments. The rules pinned here are the ones a resident
 * feels: slots never overrun the agent's window, one clock is shown to
 * everyone with its time zone named, reminders are not sent right after a
 * late booking, and bookings must say what they are about.
 */

import { describe, expect, it } from "vitest";

import { basePreparation } from "@/modules/appointments/appointments.preparation";
import { reminderIsUseful } from "@/modules/appointments/appointments.reminders";
import { bookAppointmentInputSchema, openSlotsInputSchema } from "@/modules/appointments/appointments.schema";
import { cityDay, formatSlot, generateSlots } from "@/modules/appointments/appointments.time";

describe("generateSlots", () => {
  it("cuts a window into equal slots in city time", () => {
    const slots = generateSlots("2026-10-07", "09:00", "10:30", 30);
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual(["2026-10-07T09:00:00.000Z", "2026-10-07T09:30:00.000Z", "2026-10-07T10:00:00.000Z"]);
    expect(slots.at(-1)?.endsAt.toISOString()).toBe("2026-10-07T10:30:00.000Z");
  });

  it("drops a last piece shorter than the slot length", () => {
    expect(generateSlots("2026-10-07", "09:00", "10:10", 30)).toHaveLength(2);
  });

  it("returns nothing for an empty or reversed window", () => {
    expect(generateSlots("2026-10-07", "10:00", "10:00", 15)).toEqual([]);
    expect(generateSlots("2026-10-07", "11:00", "10:00", 15)).toEqual([]);
    expect(generateSlots("07/10/2026", "09:00", "10:00", 15)).toEqual([]);
  });
});

describe("formatSlot", () => {
  it("names the day, both times and the time zone", () => {
    expect(formatSlot("2026-10-06T10:00:00.000Z", "2026-10-06T10:30:00.000Z")).toBe("mardi 6 octobre 2026, 10:00–10:30 (heure de Terra Nova)");
    expect(formatSlot("2026-10-06T10:00:00.000Z", "2026-10-06T10:30:00.000Z", "en")).toBe("Tuesday, 6 October 2026, 10:00–10:30 (Terra Nova time)");
  });

  it("groups by the city-time day", () => {
    expect(cityDay("2026-10-06T23:30:00.000Z")).toBe("2026-10-06");
  });
});

describe("reminderIsUseful", () => {
  const start = new Date("2026-10-07T10:00:00Z");
  it("sends the day-before reminder only for bookings made earlier than that", () => {
    expect(reminderIsUseful("day", start, new Date("2026-10-03T10:00:00Z"))).toBe(true);
    expect(reminderIsUseful("day", start, new Date("2026-10-07T06:00:00Z"))).toBe(false);
  });

  it("skips the one-hour reminder for a slot booked just before", () => {
    expect(reminderIsUseful("hour", start, new Date("2026-10-07T07:00:00Z"))).toBe(true);
    expect(reminderIsUseful("hour", start, new Date("2026-10-07T09:15:00Z"))).toBe(false);
  });
});

describe("inputs", () => {
  it("requires a reason to book", () => {
    expect(bookAppointmentInputSchema.safeParse({ slotId: "s1", reason: "rdv" }).success).toBe(false);
    expect(bookAppointmentInputSchema.safeParse({ slotId: "s1", reason: "Renouveler ma carte de résident" }).success).toBe(true);
  });

  it("requires a place for an in-person slot and a sensible window", () => {
    const base = { date: "2026-10-07", from: "09:00", to: "12:00", duration: 30 };
    expect(openSlotsInputSchema.safeParse({ ...base, mode: "IN_PERSON" }).success).toBe(false);
    expect(openSlotsInputSchema.safeParse({ ...base, mode: "PHONE" }).success).toBe(true);
    expect(openSlotsInputSchema.safeParse({ ...base, mode: "PHONE", duration: 25 }).success).toBe(false);
    expect(openSlotsInputSchema.safeParse({ ...base, to: "08:00", mode: "PHONE" }).success).toBe(false);
  });
});

describe("basePreparation", () => {
  it("always gives the reference and where to be", () => {
    const steps = basePreparation({ reference: "RDV-123456", mode: "IN_PERSON", location: "Hôtel de ville, guichet 2", serviceName: null, serviceHowTo: "Apportez votre ancienne carte", reason: "Carte" });
    expect(steps[0]).toContain("RDV-123456");
    expect(steps.some((step) => step.includes("guichet 2"))).toBe(true);
    expect(steps).toContain("Apportez votre ancienne carte.");
  });
});
