import { describe, expect, it } from "vitest";

import { auditActions } from "@/modules/audit/audit.schema";

describe("passkey sign-in (D02)", () => {
  it("audits adding and removing a passkey", () => {
    expect(auditActions.passkeyAdded).toBe("user.passkey_added");
    expect(auditActions.passkeyRemoved).toBe("user.passkey_removed");
  });
});
