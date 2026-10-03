import { describe, expect, it } from "vitest";

import { announcementInputSchema } from "@/modules/announcements/announcements.schema";
import { cityRequestRefParamSchema, createCityRequestSchema, listCityRequestsQuerySchema, updateCityRequestSchema } from "@/modules/city-requests/city-requests.schema";
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

  it("requires a place for a reported problem (F25)", () => {
    const base = { subject: "Lampadaire cassé", message: "Le lampadaire ne s'allume plus depuis hier." };
    expect(createCityRequestSchema.safeParse({ ...base, issueType: "lighting" }).success).toBe(false);
    expect(createCityRequestSchema.safeParse({ ...base, issueType: "lighting", location: "Rue des Dômes, module 12" }).success).toBe(true);
    expect(createCityRequestSchema.safeParse({ ...base, issueType: "lighting", latitude: 48.85, longitude: 2.35 }).success).toBe(true);
    expect(createCityRequestSchema.safeParse({ ...base, issueType: "lighting", location: "Ici", latitude: 48.85 }).success).toBe(false);
    expect(createCityRequestSchema.safeParse({ ...base, issueType: "meteor" }).success).toBe(false);
    expect(createCityRequestSchema.safeParse(base).success).toBe(true);
  });

  it("filters ongoing and finished requests (F26) and unassigned ones (D17)", () => {
    expect(listCityRequestsQuerySchema.safeParse({ status: "DONE" }).success).toBe(true);
    expect(listCityRequestsQuerySchema.safeParse({ scope: "unassigned" }).success).toBe(true);
    expect(listCityRequestsQuerySchema.safeParse({ scope: "everyone" }).success).toBe(false);
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

  it("keeps only non-empty English copies and refuses unknown languages (F27)", () => {
    const base = { name: "Service", category: "Démarches", summary: "Un résumé court", description: "Une description assez longue." };
    const parsed = serviceInputSchema.safeParse({ ...base, translations: { en: { name: "Service EN", summary: "" } } });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.translations).toEqual({ en: { name: "Service EN" } });
    expect(serviceInputSchema.safeParse({ ...base, translations: { de: { name: "Dienst" } } }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...base, featured: true }).data?.featured).toBe(true);
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
