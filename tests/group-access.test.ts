import { describe, expect, it } from "vitest";

import { canManageMember, resolveGroupAccess } from "@/modules/groups/groups.access";

const open = { privacy: "PUBLIC" as const, deletedAt: null };
const closed = { privacy: "PRIVATE" as const, deletedAt: null };
const user = { role: "USER" as const };

describe("group access", () => {
  it("lets anyone read a public group but only members post", () => {
    const guest = resolveGroupAccess(open, null, null);
    expect(guest.canRead).toBe(true);
    expect(guest.canPost).toBe(false);
  });

  it("hides a private group from non-members and pending requests", () => {
    expect(resolveGroupAccess(closed, user, null).canRead).toBe(false);
    expect(resolveGroupAccess(closed, user, { role: "MEMBER", status: "PENDING" }).canRead).toBe(false);
    expect(resolveGroupAccess(closed, user, { role: "MEMBER", status: "ACTIVE" }).canRead).toBe(true);
  });

  it("grants nothing to a banned member, whatever their old role", () => {
    const access = resolveGroupAccess(closed, user, { role: "ADMIN", status: "BANNED" });
    expect(access.canRead || access.canPost || access.canModerate).toBe(false);
  });

  it("separates moderation from settings and deletion", () => {
    const mod = resolveGroupAccess(open, user, { role: "MODERATOR", status: "ACTIVE" });
    expect([mod.canModerate, mod.canEditSettings, mod.canDelete]).toEqual([true, false, false]);
    const owner = resolveGroupAccess(open, user, { role: "OWNER", status: "ACTIVE" });
    expect(owner.canDelete).toBe(true);
  });

  it("lets platform staff read and moderate without posting", () => {
    const staff = resolveGroupAccess(closed, { role: "MODERATOR" }, null);
    expect([staff.canRead, staff.canModerate, staff.canPost, staff.canDelete]).toEqual([true, true, false, false]);
  });

  it("never lets a manager act on a peer or promote to their own rank", () => {
    expect(canManageMember("MODERATOR", false, "MEMBER")).toBe(true);
    expect(canManageMember("MODERATOR", false, "MODERATOR")).toBe(false);
    expect(canManageMember("MODERATOR", false, "MEMBER", "MODERATOR")).toBe(false);
    expect(canManageMember("ADMIN", false, "MEMBER", "MODERATOR")).toBe(true);
    expect(canManageMember("ADMIN", false, "OWNER")).toBe(false);
    expect(canManageMember(null, true, "ADMIN", "MEMBER")).toBe(true);
  });
});
