import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/http/safe-redirect";

describe("safe post-login redirect", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/messages?room=abc")).toBe("/messages?room=abc");
    expect(safeNextPath("/groups/club")).toBe("/groups/club");
  });

  it("refuses anything that can leave the site", () => {
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/%0d%0aSet-Cookie", "evil", "/\u0000x"]) {
      expect(safeNextPath(evil)).toBe(evil === "/%0d%0aSet-Cookie" ? "/%0d%0aSet-Cookie" : "/feed");
    }
  });

  it("never sends a signed-in user back to an auth page", () => {
    expect(safeNextPath("/login")).toBe("/feed");
    expect(safeNextPath("/2fa?x=1")).toBe("/feed");
  });
});
