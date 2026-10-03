import { describe, expect, it } from "vitest";

import { openStateAt, openingHoursSchema, parseOpeningHours, type OpeningHours } from "@/modules/city-services/opening-hours";

const WEEK: OpeningHours = {
  mon: { open: "08:30", close: "17:00" },
  tue: { open: "08:30", close: "17:00" },
  wed: null,
  thu: { open: "14:00", close: "19:00" },
  fri: { open: "08:30", close: "17:00" },
  sat: null,
  sun: null,
};

/** 5 October 2026 is a Monday. */
const at = (day: number, time: string) => new Date(`2026-10-${String(day).padStart(2, "0")}T${time}:00Z`);

describe("opening hours (F74)", () => {
  it("says open and when it closes during opening hours", () => {
    expect(openStateAt(WEEK, at(5, "10:00"))).toMatchObject({ open: true, today: "mon", closesAt: "17:00", nextOpen: null });
  });

  it("is closed at the closing minute and points to the next opening", () => {
    expect(openStateAt(WEEK, at(5, "17:00"))).toMatchObject({ open: false, nextOpen: { day: "tue", time: "08:30", inDays: 1 } });
  });

  it("announces a later opening the same day", () => {
    expect(openStateAt(WEEK, at(8, "09:00"))).toMatchObject({ open: false, today: "thu", nextOpen: { day: "thu", time: "14:00", inDays: 0 } });
  });

  it("skips closed days, across the weekend", () => {
    expect(openStateAt(WEEK, at(9, "18:00"))).toMatchObject({ open: false, nextOpen: { day: "mon", time: "08:30", inDays: 3 } });
  });

  it("reports a place open around the clock without a closing time", () => {
    const always = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, { open: "00:00", close: "23:59" }])) as OpeningHours;
    expect(openStateAt(always, at(7, "03:00"))).toMatchObject({ open: true, always: true, closesAt: null });
  });

  it("has no next opening when every day is closed", () => {
    expect(openStateAt({}, at(5, "10:00"))).toMatchObject({ open: false, nextOpen: null });
  });

  it("rejects a closing time before the opening time", () => {
    expect(openingHoursSchema.safeParse({ mon: { open: "17:00", close: "08:00" } }).success).toBe(false);
    expect(openingHoursSchema.safeParse({ mon: { open: "08:00", close: "17:00" }, sun: null }).success).toBe(true);
  });

  it("drops malformed stored days instead of failing", () => {
    expect(parseOpeningHours({ mon: { open: "8h", close: "17:00" }, tue: { open: "09:00", close: "12:00" }, extra: 1 })).toEqual({
      mon: null, tue: { open: "09:00", close: "12:00" }, wed: null, thu: null, fri: null, sat: null, sun: null,
    });
    expect(parseOpeningHours("lundi 8h")).toBeNull();
  });
});
