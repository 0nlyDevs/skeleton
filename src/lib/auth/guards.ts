/**
 * Authorization guards.
 *
 * Every read, update and delete in the application goes through one of these.
 * The rules they encode:
 *
 *   * **Deny by default.** `requireAuth` is the baseline; anything stricter is
 *     layered on top.
 *   * **Not-yours looks like not-found.** `assertOwner` throws 404, never 403,
 *     when the caller does not own the row. A 403 would confirm that the id
 *     exists, which is exactly the enumeration oracle an access-control test
 *     probes for.
 *   * **Staff privilege is explicit.** Roles are passed in, never inferred from
 *     "the UI hides it".
 */

import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import type { AuthContext, AuthUser, Role } from "@/types";

import { getAuthContext } from "./session";
import { ADMIN_ROLES, STAFF_ROLES, canAssignRole, roleIn } from "./roles";

/** The shape every owned row must expose. */
export interface OwnedResource {
  readonly userId: string;
}

/** Require any authenticated, non-banned session. */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) throw new UnauthenticatedError();
  return context;
}

export async function requireUser(): Promise<AuthUser> {
  const { user } = await requireAuth();
  return user;
}

/** Require a specific set of roles. */
export async function requireRole(roles: readonly Role[]): Promise<AuthContext> {
  const context = await requireAuth();

  if (!roleIn(context.user.role, roles)) {
    throw new ForbiddenError("Your account does not have access to this area.");
  }

  return context;
}

/** Require MODERATOR or ADMIN. */
export async function requireStaff(): Promise<AuthContext> {
  return requireRole(STAFF_ROLES);
}

/** Require ADMIN. */
export async function requireAdmin(): Promise<AuthContext> {
  return requireRole(ADMIN_ROLES);
}

export function isStaff(user: AuthUser): boolean {
  return roleIn(user.role, STAFF_ROLES);
}

export function isAdmin(user: AuthUser): boolean {
  return roleIn(user.role, ADMIN_ROLES);
}

/**
 * True when `user` may act on `resource`: either they own it, or they hold one
 * of `allowRoles`.
 */
export function canAccessOwnedResource(
  resource: OwnedResource,
  user: AuthUser,
  allowRoles: readonly Role[] = [],
): boolean {
  if (resource.userId === user.id) return true;
  return allowRoles.length > 0 && roleIn(user.role, allowRoles);
}

export interface AssertOwnerOptions {
  /** Roles that may act on resources they do not own. */
  readonly allowRoles?: readonly Role[];
  /** Message used when the resource is missing entirely. */
  readonly message?: string;
}

/**
 * Assert that `user` may act on `resource`, and return it narrowed to
 * non-null.
 *
 * Both "does not exist" and "exists but is not yours" raise 404 on purpose, so
 * the response cannot be used to discover which identifiers are real.
 */
export function assertOwner<T extends OwnedResource>(
  resource: T | null | undefined,
  user: AuthUser,
  options: AssertOwnerOptions = {},
): T {
  const message = options.message ?? "The requested resource was not found.";

  if (!resource) throw new NotFoundError(message);
  if (canAccessOwnedResource(resource, user, options.allowRoles ?? [])) return resource;

  throw new NotFoundError(message);
}

/** Same contract as `assertOwner`, with staff implicitly allowed. */
export function assertOwnerOrStaff<T extends OwnedResource>(
  resource: T | null | undefined,
  user: AuthUser,
  options: Omit<AssertOwnerOptions, "allowRoles"> = {},
): T {
  return assertOwner(resource, user, { ...options, allowRoles: STAFF_ROLES });
}

/**
 * Guard a role transition. Nobody may grant a role higher than their own, which
 * is what stops a moderator — or a compromised admin session — from minting a
 * new admin.
 */
export function assertCanAssignRole(actor: AuthUser, target: Role): void {
  if (!canAssignRole(actor.role, target)) {
    throw new ForbiddenError("You cannot grant a role above your own.");
  }
}
