import { describe, expect, it } from "vitest";

import { MAX_MENTIONS, extractMentions } from "@/lib/mentions";

describe("mentions", () => {
  it("finds handles and lowercases them", () => {
    expect(extractMentions("Hi @Aline and @bilal.d!")).toEqual(["aline", "bilal.d"]);
  });

  it("ignores email addresses and duplicates", () => {
    expect(extractMentions("mail joe@example.com, ping @joe @joe @jo")).toEqual(["joe"]);
  });

  it("caps the fan-out", () => {
    const text = Array.from({ length: 20 }, (_, index) => `@user${index}x`).join(" ");
    expect(extractMentions(text)).toHaveLength(MAX_MENTIONS);
  });
});
