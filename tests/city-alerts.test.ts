import { describe, expect, it } from "vitest";

import { createAlertSchema } from "@/modules/alerts/alerts.schema";
import {
  CITY_ZONES,
  CITY_ZONE_IDS,
  alertTargetsZone,
  zoneAt,
  zoneCentroid,
  zoneHealth,
  zonesForAlertScope,
} from "@/modules/alerts/city-zones";

describe("alert scope", () => {
  it("reaches every district for ALL, even residents without one", () => {
    expect(zonesForAlertScope("ALL")).toEqual(CITY_ZONE_IDS);
    expect(alertTargetsZone("ALL", null)).toBe(true);
  });

  it("groups districts by compass region", () => {
    expect(zonesForAlertScope("SOUTH")).toEqual(["SUNKEN_DELTA", "OBSIDIAN_COAST"]);
    expect(alertTargetsZone("SOUTH", "SUNKEN_DELTA")).toBe(true);
    expect(alertTargetsZone("SOUTH", "FROSTPEAK")).toBe(false);
  });

  it("targets one district only, and never a resident with no district", () => {
    expect(alertTargetsZone("NOVA_PRIME", "NOVA_PRIME")).toBe(true);
    expect(alertTargetsZone("NOVA_PRIME", "SKYPORT_ISLES")).toBe(false);
    expect(alertTargetsZone("NOVA_PRIME", null)).toBe(false);
  });

  it("rejects unknown scopes and extra fields", () => {
    const base = { title: "Montée des eaux", summary: "Le niveau monte dans le sud.", body: "Éloignez-vous des berges." };
    expect(createAlertSchema.safeParse({ ...base, scope: "MARS" }).success).toBe(false);
    expect(createAlertSchema.safeParse({ ...base, authorId: "x" }).success).toBe(false);
    expect(createAlertSchema.safeParse(base).success).toBe(true);
  });
});

describe("district health", () => {
  it("is safe and full without alerts", () => {
    expect(zoneHealth([])).toEqual({ score: 100, status: "SAFE" });
  });

  it("takes the worst alert as status and never drops below 5", () => {
    expect(zoneHealth(["INFORMATION", "WARNING"])).toEqual({ score: 60, status: "WARNING" });
    expect(zoneHealth(["CRITICAL", "CRITICAL"]).status).toBe("DANGER");
    expect(zoneHealth(["CRITICAL", "CRITICAL"]).score).toBe(5);
  });
});

describe("map geometry", () => {
  it("finds each district at its own centre", () => {
    for (const zone of CITY_ZONES) {
      const [x, y] = zoneCentroid(zone);
      expect(zoneAt(x, y)).toBe(zone.id);
    }
  });

  it("finds no district in the sea", () => {
    expect(zoneAt(5, 5)).toBeNull();
  });
});
