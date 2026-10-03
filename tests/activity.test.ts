import { describe, expect, it } from "vitest";

import { createTranslator } from "@/lib/i18n";
import { describeActivity } from "@/modules/activity/activity.describe";
import type { ActivityEntryDto } from "@/modules/activity/activity.dto";
import { changedFields } from "@/modules/audit/audit.diff";
import { ADMIN_ACTIONS, auditActions } from "@/modules/audit/audit.schema";

const t = createTranslator("fr");
const entry = (overrides: Partial<ActivityEntryDto>): ActivityEntryDto => ({
  id: "a1",
  action: auditActions.cityRequestChanged,
  category: "requests",
  op: "update",
  actor: { id: "u1", name: "Marie Agent", role: "MODERATOR" },
  target: { type: "city_request", id: "r1", label: "TN-100003", href: "/agent/requests/TN-100003" },
  details: {},
  createdAt: "2026-10-03T10:00:00.000Z",
  ...overrides,
});

describe("agent history (D21)", () => {
  it("says who changed what on a request, with the before and after", () => {
    const { sentence, details } = describeActivity(
      entry({ details: { op: "update", changes: [{ kind: "status", from: "NEW", to: "IN_PROGRESS" }] } }),
      t,
      (iso) => iso,
    );
    expect(sentence).toBe("Marie Agent a modifié la demande TN-100003");
    expect(details).toContain("Statut : Nouvelle → En cours");
  });

  it("names the fields an edit touched", () => {
    const { details } = describeActivity(
      entry({ action: auditActions.serviceChanged, category: "services", target: { type: "service", id: "s1", label: "Santé", href: null }, details: { op: "update", changed: ["hours", "phone"] } }),
      t,
      (iso) => iso,
    );
    expect(details).toContain("Modifié : horaires, téléphone");
  });

  it("only reports fields whose value really changed", () => {
    expect(changedFields({ name: "A", hours: "9h", active: true }, { name: "A", hours: "10h", active: true }, ["name", "hours", "active"])).toEqual(["hours"]);
  });

  it("keeps administrative actions out of the retention cleanup", () => {
    expect(ADMIN_ACTIONS).toContain(auditActions.userRoleChanged);
    expect(ADMIN_ACTIONS).toContain(auditActions.transportChanged);
    expect(ADMIN_ACTIONS).not.toContain(auditActions.userSignedIn);
  });
});
