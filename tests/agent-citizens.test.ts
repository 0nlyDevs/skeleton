import { describe, expect, it } from "vitest";

import { agentListCitizensQuerySchema } from "@/modules/users/users.schema";

describe("agent citizen accounts (F34)", () => {
  it("filters by status and never takes a role from the query", () => {
    expect(agentListCitizensQuerySchema.parse({}).status).toBe("all");
    expect(agentListCitizensQuerySchema.safeParse({ status: "suspended" }).success).toBe(true);
    expect(agentListCitizensQuerySchema.safeParse({ status: "admins" }).success).toBe(false);
    // The schema has no role field: an agent cannot ask for staff accounts.
    expect(agentListCitizensQuerySchema.parse({ role: "ADMIN" })).not.toHaveProperty("role");
  });
});
