/**
 * User administration and self-service profile.
 *
 * The interesting rules are the ones that protect the platform from its own
 * administrators:
 *
 *   * **Nobody edits their own privileges.** Changing your own role or banning
 *     yourself is refused outright, so a compromised admin session cannot quietly
 *     escalate or destroy its own audit trail.
 *   * **The last admin is protected.** Demoting or banning the only remaining
 *     admin is refused, because that state has no recovery path through the UI.
 *   * **Nobody grants above their own rank.** Enforced by `assertCanAssignRole`.
 *   * **Bans take effect immediately.** The ban also deletes the user's sessions,
 *     so an already-open browser is logged out on its next request rather than
 *     waiting for the token to expire.
 */

import { assertCanAssignRole } from "@/lib/auth/guards";
import { auth } from "@/lib/auth/auth";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { paginate, resolveSortField, toPagination, type Paginated } from "@/lib/pagination";
import { parseDateInput } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { notifyRoleChanged, notifySystemMessage } from "../notifications/notifications.service";
import { toAdminUserDto, toUserProfileDto, type AdminUserDto, type UserProfileDto } from "./users.dto";
import {
  countAdmins,
  countUsers,
  deleteOtherSessions,
  deleteOwnSession,
  deleteUserSessions,
  findAdminUserById,
  findUserProfileById,
  findUsers,
  updateUserBan,
  updateUserProfile,
  updateUserRoleAdmin,
} from "./users.repository";
import type {
  AdminListUsersQuery,
  ChangePasswordInput,
  UpdateProfileInput,
  UpdateUserBanInput,
  UpdateUserRoleInput,
} from "./users.schema";

export interface ActorContext {
  readonly user: AuthUser;
  readonly ip?: string;
}

const SORTABLE_FIELDS = ["createdAt", "name", "email", "role"] as const;

// --- Admin ------------------------------------------------------------------

export async function listUsersForAdmin(
  query: AdminListUsersQuery,
): Promise<Paginated<AdminUserDto>> {
  const pagination = toPagination(query);
  const sortField = resolveSortField(query.sort ?? "createdAt", SORTABLE_FIELDS, "createdAt");

  const where = {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { email: { contains: query.q } },
          ],
        }
      : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.banned !== undefined ? { banned: query.banned } : {}),
    ...(query.emailVerified !== undefined ? { emailVerified: query.emailVerified } : {}),
  };

  const [rows, total] = await Promise.all([
    findUsers({
      where,
      orderBy: { [sortField]: query.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    countUsers(where),
  ]);

  return paginate(rows.map(toAdminUserDto), {
    page: pagination.page,
    limit: pagination.limit,
    total,
  });
}

export async function getUserForAdmin(id: string): Promise<AdminUserDto> {
  const row = await findAdminUserById(id);
  if (!row) throw new NotFoundError("That account does not exist.");
  return toAdminUserDto(row);
}

async function guardLastAdmin(targetId: string, action: string): Promise<void> {
  const target = await findAdminUserById(targetId);
  if (!target) throw new NotFoundError("That account does not exist.");

  if (target.role === "ADMIN" && !target.banned) {
    const admins = await countAdmins();
    if (admins <= 1) {
      throw new ConflictError(
        `This is the only active admin. Promote another account before you ${action}.`,
      );
    }
  }
}

export async function changeUserRole(
  id: string,
  input: UpdateUserRoleInput,
  actor: ActorContext,
): Promise<AdminUserDto> {
  if (id === actor.user.id) {
    throw new ForbiddenError("You cannot change your own role.");
  }

  assertCanAssignRole(actor.user, input.role);

  if (input.role !== "ADMIN") {
    await guardLastAdmin(id, "demote this account");
  }

  const before = await findAdminUserById(id);
  if (!before) throw new NotFoundError("That account does not exist.");

  if (before.role === input.role) return toAdminUserDto(before);

  const updated = await updateUserRoleAdmin(id, input.role);

  // A role change must apply to an already-open session. Sessions are keyed by
  // the same user row, so the authoritative check in `getAuthContext` picks the
  // new role up on the next request — no cache to bust.
  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.userRoleChanged,
    targetType: "user",
    targetId: id,
    metadata: { from: before.role, to: input.role },
    ip: actor.ip ?? null,
  });

  await notifyRoleChanged(id, input.role);

  return toAdminUserDto(updated);
}

export async function setUserBan(
  id: string,
  input: UpdateUserBanInput,
  actor: ActorContext,
): Promise<AdminUserDto> {
  if (id === actor.user.id) {
    throw new ForbiddenError("You cannot ban your own account.");
  }

  if (input.banned) {
    await guardLastAdmin(id, "ban this account");
  }

  const expiresAt = input.banned ? parseDateInput(input.expiresAt) : undefined;
  if (input.expiresAt && input.banned && !expiresAt) {
    throw new BadRequestError("That expiry date could not be understood.");
  }

  const updated = await updateUserBan(id, {
    banned: input.banned,
    banReason: input.banned ? (input.reason ?? null) : null,
    banExpires: input.banned ? (expiresAt ?? null) : null,
  });

  if (input.banned) {
    // Cut existing sessions immediately rather than waiting for expiry.
    const revoked = await deleteUserSessions(id);
    await recordAudit({
      actorId: actor.user.id,
      action: auditActions.userBanned,
      targetType: "user",
      targetId: id,
      metadata: { reason: input.reason ?? null, expiresAt: expiresAt ?? null, revokedSessions: revoked },
      ip: actor.ip ?? null,
    });
  } else {
    await recordAudit({
      actorId: actor.user.id,
      action: auditActions.userUnbanned,
      targetType: "user",
      targetId: id,
      ip: actor.ip ?? null,
    });
    await notifySystemMessage({
      userId: id,
      title: "Your account has been reinstated",
      body: "You can sign in again.",
      link: "/login",
    });
  }

  return toAdminUserDto(updated);
}

// --- Self service -----------------------------------------------------------

export async function getOwnProfile(actor: ActorContext): Promise<UserProfileDto> {
  const row = await findUserProfileById(actor.user.id);
  if (!row) throw new NotFoundError("Your account could not be loaded.");
  return toUserProfileDto(row);
}

export async function updateOwnProfile(
  input: UpdateProfileInput,
  actor: ActorContext,
): Promise<UserProfileDto> {
  const data: { name?: string; bio?: string; image?: string | null } = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.bio !== undefined) data.bio = input.bio;
  if (input.image !== undefined) data.image = input.image;

  const row = await updateUserProfile(actor.user.id, data);

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.userProfileUpdated,
    targetType: "user",
    targetId: actor.user.id,
    metadata: { changed: Object.keys(data) },
    ip: actor.ip ?? null,
  });

  return toUserProfileDto(row);
}

/**
 * Sign out one device.
 *
 * Sessions are addressed by id, never by token: the token *is* the credential,
 * so it must never be sent to the browser — not even the user's own other
 * tokens, which any XSS on the settings page could otherwise collect.
 */
export async function revokeOwnSession(
  sessionId: string,
  context: { readonly userId: string; readonly currentSessionId: string; readonly ip?: string },
): Promise<void> {
  if (sessionId === context.currentSessionId) {
    throw new BadRequestError("Use sign out to end the current session.");
  }

  const revoked = await deleteOwnSession(context.userId, sessionId);
  if (revoked === 0) throw new NotFoundError("That session does not exist.");

  await recordAudit({
    actorId: context.userId,
    action: auditActions.userSessionsRevoked,
    targetType: "user",
    targetId: context.userId,
    metadata: { revoked },
    ip: context.ip ?? null,
  });
}

export async function revokeOtherOwnSessions(context: {
  readonly userId: string;
  readonly currentSessionId: string;
  readonly ip?: string;
}): Promise<number> {
  const revoked = await deleteOtherSessions(context.userId, context.currentSessionId);

  await recordAudit({
    actorId: context.userId,
    action: auditActions.userSessionsRevoked,
    targetType: "user",
    targetId: context.userId,
    metadata: { revoked },
    ip: context.ip ?? null,
  });

  return revoked;
}

/**
 * Change the caller's password.
 *
 * Delegated to BetterAuth so the re-hash, the current-password check and the
 * "revoke other sessions" behaviour all stay in one place. `headers` is passed in
 * rather than read from `next/headers` so this stays callable from a script.
 */
export async function changeOwnPassword(
  input: ChangePasswordInput,
  context: { readonly userId: string; readonly headers: Headers; readonly ip?: string },
): Promise<void> {
  const response = await auth.api.changePassword({
    body: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      revokeOtherSessions: true,
    },
    headers: context.headers,
    asResponse: true,
  });

  if (!response.ok) {
    // Never forward the provider message: "incorrect password" vs "user not
    // found" is exactly the distinction an attacker is probing for.
    throw new BadRequestError("The current password is incorrect.");
  }

  await recordAudit({
    actorId: context.userId,
    action: auditActions.userPasswordChanged,
    targetType: "user",
    targetId: context.userId,
    ip: context.ip ?? null,
  });
}
