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

import { assertCanAssignRole, isStaff } from "@/lib/auth/guards";
import { auth } from "@/lib/auth/auth";
import type { Prisma } from "@/generated/prisma/client";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError, fromPrismaError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { publishProfileUpdated } from "@/lib/socket/emit";
import { encryptField } from "@/lib/crypto/field-encryption";
import { composeDisplayName, formatBirthDate, normalizeUsername, usernameViolation } from "@/lib/validation/profile";
import { paginate, resolveSortField, toPagination, type Paginated } from "@/lib/pagination";
import { parseDateInput } from "@/lib/utils";
import { disconnectUserSockets } from "@/lib/socket/emit";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { notifyInBackground } from "../notifications/notifications.service";
import { notifyRoleChanged, notifySystemMessage } from "../notifications/notifications.service";
import { toAdminUserDto, toUserProfileDto, type AdminUserDto, type UserProfileDto } from "./users.dto";
import { assertOwnPublicImage } from "../uploads/uploads.service";
import {
  countAdmins,
  countCredentialAccounts,
  countUsers,
  deleteOtherSessions,
  deleteOwnSession,
  deleteUserSessions,
  findAdminUserById,
  findOnboardingCompletedAt,
  findUserIdByUsername,
  findUserProfileById,
  findUsers,
  markOnboardingCompleted,
  updateUserBan,
  updateUserProfile,
  updateUserRoleAdmin,
} from "./users.repository";

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
import type {
  AdminListUsersQuery,
  AgentListCitizensQuery,
  ChangePasswordInput,
  SetInitialPasswordInput,
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

/** D12 — whether the welcome guide still has to open by itself for this account. */
export async function needsOnboarding(userId: string): Promise<boolean> {
  return (await findOnboardingCompletedAt(userId)) === null;
}

/** The resident finished or skipped the guide: it will not open by itself again, on any device. */
export async function completeOnboarding(userId: string): Promise<void> {
  await markOnboardingCompleted(userId);
}

/**
 * F34 — city agents administer resident accounts, and only those: the list
 * never includes staff, and every action refuses a non-resident target, so an
 * agent can neither see nor touch another agent's or an admin's account.
 * Roles stay an administrator's decision (`changeUserRole`).
 */
export async function listCitizensForAgent(query: AgentListCitizensQuery): Promise<Paginated<AdminUserDto>> {
  return listUsersForAdmin({
    page: query.page,
    limit: query.limit,
    sort: "createdAt",
    order: "desc",
    role: "USER",
    ...(query.q ? { q: query.q } : {}),
    ...(query.status === "active" ? { banned: false } : {}),
    ...(query.status === "suspended" ? { banned: true } : {}),
    ...(query.status === "unverified" ? { emailVerified: false } : {}),
  });
}

async function assertCitizenTarget(id: string, actor: ActorContext): Promise<void> {
  if (!isStaff(actor.user)) throw new ForbiddenError();
  const target = await findAdminUserById(id);
  if (!target) throw new NotFoundError("That account does not exist.");
  if (target.role !== "USER") throw new ForbiddenError("Agents can only manage resident accounts.");
}

/** Suspend or reinstate a resident; suspension signs them out everywhere (see `setUserBan`). */
export async function setCitizenSuspension(id: string, input: UpdateUserBanInput, actor: ActorContext): Promise<AdminUserDto> {
  await assertCitizenTarget(id, actor);
  return setUserBan(id, input, actor);
}

/** Sign a resident out of every device, e.g. after a suspicious sign-in they reported. */
export async function signOutCitizenEverywhere(id: string, actor: ActorContext): Promise<{ revoked: number }> {
  await assertCitizenTarget(id, actor);
  const revoked = await deleteUserSessions(id);
  disconnectUserSockets(id);
  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.userSessionsRevoked,
    targetType: "user",
    targetId: id,
    metadata: { by: "agent", revokedSessions: revoked },
    ip: actor.ip ?? null,
  });
  await notifySystemMessage({
    userId: id,
    title: "Vos sessions ont été fermées",
    body: "Un agent de la ville vous a déconnecté de tous vos appareils pour protéger votre compte. Reconnectez-vous ; changez votre mot de passe si vous ne reconnaissez pas une connexion.",
    link: "/settings/security",
  });
  return { revoked };
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
  disconnectUserSockets(id);

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
    disconnectUserSockets(id);
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
      title: "Votre compte a été rétabli",
      body: "Vous pouvez de nouveau vous connecter.",
      link: "/login",
    });
  }

  return toAdminUserDto(updated);
}

/** Apply the profile action from the staff moderation queue. */
export async function removeUserProfileAsStaff(
  id: string,
  actor: ActorContext,
  note: string | null,
): Promise<void> {
  if (!isStaff(actor.user)) throw new ForbiddenError();
  if (id === actor.user.id) throw new ForbiddenError("You cannot suspend your own account.");

  const target = await findAdminUserById(id);
  if (!target) throw new NotFoundError("That profile does not exist.");
  if (actor.user.role === "MODERATOR" && target.role === "ADMIN") {
    throw new ForbiddenError("Moderators cannot suspend an admin account.");
  }
  if (target.banned) return;

  await guardLastAdmin(id, "suspend this account");
  await updateUserBan(id, {
    banned: true,
    banReason: note?.trim() || "Profil retiré après examen de la modération.",
    banExpires: null,
  });
  const revokedSessions = await deleteUserSessions(id);
  disconnectUserSockets(id);

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.userBanned,
    targetType: "user",
    targetId: id,
    metadata: { source: "moderation_report", revokedSessions },
    ip: actor.ip ?? null,
  });
  notifyInBackground(
    notifySystemMessage({
      userId: id,
      title: "Votre profil a été suspendu",
      body: note?.trim() || "Votre profil a été retiré après un examen de la modération.",
      link: "/",
    }),
    { userId: id, action: "profile_suspended" },
  );
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
  const current = await findUserProfileById(actor.user.id);
  if (!current) throw new NotFoundError("Your account could not be loaded.");

  const data: Prisma.UserUncheckedUpdateInput = {};

  if (input.username !== undefined && input.username !== current.username) {
    // A handle is how people find and mention someone: it may change once a
    // month, so it cannot be used to dodge reports or impersonate in a hurry.
    const changedAt = current.usernameChangedAt;
    if (changedAt && Date.now() - changedAt.getTime() < USERNAME_COOLDOWN_MS) {
      const next = new Date(changedAt.getTime() + USERNAME_COOLDOWN_MS);
      throw new ConflictError(`You can change your username again on ${next.toISOString().slice(0, 10)}.`, {
        username: `You can change your username again on ${next.toISOString().slice(0, 10)}.`,
      });
    }
    const holder = await findUserIdByUsername(input.username);
    if (holder && holder !== actor.user.id) {
      throw new ConflictError("This username is already taken.", {
        username: "This username is already taken.",
      });
    }
    data.username = input.username;
    data.displayUsername = input.username;
    data.usernameChangedAt = new Date();
  }
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.firstName !== undefined || input.lastName !== undefined) {
    data.name = composeDisplayName(
      input.firstName ?? current.firstName ?? "",
      input.lastName ?? current.lastName ?? "",
    );
  }
  if (input.birthDate !== undefined) {
    data.birthDateEncrypted = input.birthDate ? encryptField(formatBirthDate(input.birthDate) ?? "") : null;
    data.birthDate = null;
  }
  if (input.bio !== undefined) data.bio = input.bio;
  // Only the caller's own public uploads may become their avatar or banner.
  if (input.image) await assertOwnPublicImage(input.image, actor.user.id);
  if (input.banner) await assertOwnPublicImage(input.banner, actor.user.id);
  if (input.image !== undefined) data.image = input.image;
  if (input.banner !== undefined) data.banner = input.banner;
  if (input.showPresence !== undefined) data.showPresence = input.showPresence;
  if (input.autoLocation !== undefined) data.autoLocation = input.autoLocation;
  if (input.cityZone !== undefined) data.cityZone = input.cityZone;

  let row;
  try {
    row = await updateUserProfile(actor.user.id, data);
  } catch (error) {
    // Two users racing for the same handle: the unique index decides.
    throw fromPrismaError(error, "This username is already taken.") ?? error;
  }

  if (data.name !== undefined || data.image !== undefined || data.username !== undefined) {
    publishProfileUpdated({ userId: row.id, name: row.name, username: row.username, image: row.image });
  }

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
  // A stolen session must not be able to brute-force the current password.
  await enforceThenRecord([
    { key: rateLimitKey("password:change", context.userId), rule: RATE_LIMITS.passwordChange },
  ]);

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
    const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (body?.code === "PASSWORD_TOO_WEAK" || body?.code === "PASSWORD_BREACHED") {
      throw new ValidationError({ newPassword: body.message ?? "This password is too weak." });
    }
    if (body?.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
      throw new ValidationError({ currentPassword: "This account has no password yet. Create one first." });
    }
    // The caller is already signed in, so naming the field leaks nothing; the
    // per-account limit above stops this from becoming a guessing oracle.
    throw new ValidationError({ currentPassword: "The current password is incorrect." });
  }

  await recordAudit({
    actorId: context.userId,
    action: auditActions.userPasswordChanged,
    targetType: "user",
    targetId: context.userId,
    ip: context.ip ?? null,
  });
}

export interface UsernameAvailability {
  readonly username: string;
  readonly available: boolean;
  /** Why it cannot be used: `invalid` (format/reserved) or `taken`. */
  readonly reason: "invalid" | "taken" | null;
  readonly message: string | null;
}

/**
 * Live check for the sign-up and profile forms. Advisory only: two people can
 * still race for a handle, and the unique index on `user.username` decides.
 * Usernames are public handles, so answering "taken" discloses nothing that a
 * profile URL would not.
 */
export async function checkUsernameAvailability(
  raw: string,
  viewer: AuthUser | null,
): Promise<UsernameAvailability> {
  const username = normalizeUsername(raw);
  const violation = usernameViolation(username);
  if (violation) return { username, available: false, reason: "invalid", message: violation };

  const holder = await findUserIdByUsername(username);
  if (holder && holder !== viewer?.id) {
    return { username, available: false, reason: "taken", message: "This username is already taken." };
  }
  return { username, available: true, reason: null, message: null };
}

export async function hasPasswordCredential(userId: string): Promise<boolean> {
  return (await countCredentialAccounts(userId)) > 0;
}

/**
 * Give an OAuth-only account a password (needed for two-factor and for signing
 * in without the provider). Refused when one already exists: changing an
 * existing password must prove knowledge of it.
 */
export async function setInitialPassword(
  input: SetInitialPasswordInput,
  context: { readonly userId: string; readonly headers: Headers; readonly ip?: string },
): Promise<void> {
  if (await hasPasswordCredential(context.userId)) {
    throw new ConflictError("This account already has a password. Change it instead.");
  }
  await auth.api.setPassword({ body: { newPassword: input.newPassword }, headers: context.headers });
  await recordAudit({
    actorId: context.userId,
    action: auditActions.userPasswordChanged,
    targetType: "user",
    targetId: context.userId,
    metadata: { initial: true },
    ip: context.ip ?? null,
  });
}
