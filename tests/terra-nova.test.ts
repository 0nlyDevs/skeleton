import { describe, expect, it } from "vitest";

import { announcementInputSchema } from "@/modules/announcements/announcements.schema";
import { cityRequestRefParamSchema, createCityRequestSchema, updateCityRequestSchema } from "@/modules/city-requests/city-requests.schema";
import { toSummaryDto } from "@/modules/city-requests/city-requests.dto";
import { serviceInputSchema } from "@/modules/city-services/city-services.schema";
import { minutesUntil, nextWaveAt } from "@/modules/webcup/webcup.schedule";

const row = {
  id: "r1",
  reference: "TN-000001",
  subject: "Fuite",
  status: "IN_PROGRESS",
  priority: "NORMAL",
  createdAt: new Date("2026-10-03T08:00:00Z"),
  updatedAt: new Date("2026-10-03T09:00:00Z"),
  service: null,
  citizen: { id: "c1", name: "Citizen" },
  assignee: null,
};

describe("city requests", () => {
  it("rejects fields a citizen must not set (mass assignment)", () => {
    const parsed = createCityRequestSchema.safeParse({ subject: "Objet", message: "Un message assez long", status: "RESOLVED" });
    expect(parsed.success).toBe(false);
  });

  it("only accepts TN-000000 references", () => {
    expect(cityRequestRefParamSchema.safeParse({ reference: "tn-000123" }).data?.reference).toBe("TN-000123");
    expect(cityRequestRefParamSchema.safeParse({ reference: "../etc" }).success).toBe(false);
  });

  it("refuses an empty update and any assignee but me or nobody", () => {
    expect(updateCityRequestSchema.safeParse({}).success).toBe(false);
    expect(updateCityRequestSchema.safeParse({ assignee: "someone-else" }).success).toBe(false);
    expect(updateCityRequestSchema.safeParse({ assignee: "me" }).success).toBe(true);
  });

  it("flags requests that need an agent's action", () => {
    expect(toSummaryDto({ ...row, status: "NEW" }, true).needsAction).toBe(true);
    expect(toSummaryDto({ ...row, lastFromCitizen: true }, true).needsAction).toBe(true);
    expect(toSummaryDto({ ...row, lastFromCitizen: false }, true).needsAction).toBe(false);
    expect(toSummaryDto({ ...row, status: "WAITING_CITIZEN", lastFromCitizen: true }, true).needsAction).toBe(false);
  });

  it("hides the citizen's identity outside the agent view", () => {
    expect(toSummaryDto(row, false).citizen).toBeNull();
    expect(toSummaryDto(row, true).citizen).toEqual({ id: "c1", name: "Citizen" });
  });
});

describe("services and announcements", () => {
  it("only allows icons from the allow-list", () => {
    const base = { name: "Énergie", category: "Infra", summary: "Le réseau", description: "Le réseau solaire de la cité." };
    expect(serviceInputSchema.safeParse({ ...base, icon: "zap" }).success).toBe(true);
    expect(serviceInputSchema.safeParse({ ...base, icon: "<script>" }).success).toBe(false);
  });

  it("only accepts covers uploaded to the app", () => {
    const base = { title: "Titre", summary: "Résumé", body: "Le contenu de l'annonce." };
    expect(announcementInputSchema.safeParse({ ...base, coverImage: "/api/files/abc_1" }).success).toBe(true);
    expect(announcementInputSchema.safeParse({ ...base, coverImage: "https://evil.example/x.png" }).success).toBe(false);
  });
});

describe("Nova Terra wave countdown", () => {
  it("counts down from the last successful sync", () => {
    const at = nextWaveAt(30, "2026-10-03T10:00:00.000Z");
    expect(at?.toISOString()).toBe("2026-10-03T10:30:00.000Z");
    expect(minutesUntil(at, Date.parse("2026-10-03T10:10:00.000Z"))).toBe(20);
    expect(minutesUntil(at, Date.parse("2026-10-03T11:00:00.000Z"))).toBe(0);
  });

  it("knows nothing without a session", () => {
    expect(nextWaveAt(null, "2026-10-03T10:00:00.000Z")).toBeNull();
    expect(nextWaveAt(10, null)).toBeNull();
    expect(minutesUntil(null)).toBeNull();
  });
});
