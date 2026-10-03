/**
 * Role model.
 *
 * Roles are a total order, not a set of capabilities: an admin can do anything
 * a moderator can, and a moderator anything a user can. Encoding that as a rank
 * means a single comparison answers "is this caller privileged enough?", and
 * there is exactly one place to change when a fourth role arrives.
 */

import { z } from "zod";

import { ROLES, type Role } from "@/types";

export { ROLES };
export type { Role };

export const roleSchema = z.enum(ROLES);

/** Higher outranks lower. */
const RANK: Record<Role, number> = {
  USER: 10,
  AGENT: 20,
  ADMIN: 30,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function roleRank(role: Role): number {
  return RANK[role];
}

/** True when `role` is equal to or higher than `minimum`. */
export function roleAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

/** True when the role appears in the allowed list. */
export function roleIn(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

/** Roles allowed to act on resources they do not own. */
export const STAFF_ROLES: readonly Role[] = ["AGENT", "ADMIN"];

/** Roles allowed into the admin area. */
export const ADMIN_ROLES: readonly Role[] = ["ADMIN"];

/**
 * Roles a given actor may assign. An admin can create another admin; nobody can
 * escalate beyond their own rank, which is the rule that stops a moderator from
 * minting an admin.
 */
export function assignableRoles(actor: Role): Role[] {
  return ROLES.filter((candidate) => RANK[candidate] <= RANK[actor]);
}

export function canAssignRole(actor: Role, target: Role): boolean {
  return RANK[target] <= RANK[actor];
}
