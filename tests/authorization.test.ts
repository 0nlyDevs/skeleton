/**
 * Authorization rules.
 *
 * These are the tests that matter most, because these functions are the only
 * thing standing between a signed-in user and someone else's data. Each case
 * describes an attack or a mistake, not just a branch.
 */

import { describe, expect, it } from "vitest";

import { assertOwner, assertOwnerOrStaff, canAccessOwnedResource } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  STAFF_ROLES,
  assignableRoles,
  canAssignRole,
  isRole,
  roleAtLeast,
  roleIn,
} from "@/lib/auth/roles";
import type { AuthUser } from "@/types";

function user(role: AuthUser["role"], id = "user-1"): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    name: "Test User",
    username: id.replace(/[^a-z0-9]/g, "_"),
    image: null,
    role,
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
  };
}

describe("role ranking", () => {
  it("treats roles as an order, not a set", () => {
    expect(roleAtLeast("ADMIN", "AGENT")).toBe(true);
    expect(roleAtLeast("AGENT", "ADMIN")).toBe(false);
    expect(roleAtLeast("USER", "USER")).toBe(true);
  });

  it("only accepts roles that exist", () => {
    expect(isRole("ADMIN")).toBe(true);
    // The value an attacker would send. It must not be treated as a role.
    expect(isRole("SUPERADMIN")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole("admin")).toBe(false);
  });

  it("keeps a moderator out of admin-only areas", () => {
    expect(roleIn("AGENT", STAFF_ROLES)).toBe(true);
    expect(roleIn("AGENT", ADMIN_ROLES)).toBe(false);
    expect(roleIn("ADMIN", ADMIN_ROLES)).toBe(true);
    expect(roleIn("USER", STAFF_ROLES)).toBe(false);
  });
});

describe("role assignment", () => {
  it("lets an admin mint another admin", () => {
    expect(canAssignRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("stops a moderator from escalating anyone, including themselves", () => {
    expect(canAssignRole("AGENT", "ADMIN")).toBe(false);
    expect(canAssignRole("USER", "AGENT")).toBe(false);
    expect(canAssignRole("USER", "ADMIN")).toBe(false);
  });

  it("offers exactly the roles an actor may grant", () => {
    expect(assignableRoles("USER")).toEqual(["USER"]);
    expect(assignableRoles("AGENT")).toEqual(["USER", "AGENT"]);
    expect(assignableRoles("ADMIN")).toEqual(["USER", "AGENT", "ADMIN"]);
  });
});

describe("ownership", () => {
  it("lets the owner act on their own row", () => {
    expect(canAccessOwnedResource({ userId: "user-1" }, user("USER"))).toBe(true);
  });

  it("does not let a stranger act, even with a role name that looks privileged", () => {
    expect(canAccessOwnedResource({ userId: "someone-else" }, user("USER"))).toBe(false);
    expect(canAccessOwnedResource({ userId: "someone-else" }, user("AGENT"))).toBe(false);
  });

  it("lets staff through when the caller asks for it", () => {
    expect(
      canAccessOwnedResource({ userId: "someone-else" }, user("AGENT"), STAFF_ROLES),
    ).toBe(true);
  });

  it("answers not-found, never forbidden, so ids cannot be probed", () => {
    const resource = { userId: "user-1" };

    // Wrong owner.
    expect(() => assertOwner(resource, user("USER", "user-2"))).toThrowError(
      expect.objectContaining({ status: 404 }),
    );

    // Missing row: indistinguishable from the case above.
    expect(() => assertOwner(null, user("USER"))).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });

  it("returns the row when access is allowed", () => {
    const resource = { userId: "user-1", title: "mine" };
    expect(assertOwner(resource, user("USER", "user-1"))).toBe(resource);
    expect(assertOwnerOrStaff(resource, user("ADMIN", "user-9"))).toBe(resource);
  });
});
