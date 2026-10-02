/**
 * Community groups.
 *
 * Every operation resolves the caller's `GroupAccess` from the database first
 * (`resolveGroupAccess`), then checks the one capability it needs. A private
 * group answers 404 to outsiders on every content read, exactly like a missing
 * one, so its existence beyond the public card leaks nothing.
 */

import { randomInt } from "node:crypto";

import { isAdmin } from "@/lib/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { syncGroupRoom } from "@/lib/socket/emit";

import { notifyGroupActivity, notifyInBackground } from "../notifications/notifications.service";
import { assertOwnPublicImage } from "../uploads/uploads.service";
import { findActiveUserById } from "../users/users.repository";
import { canManageMember, resolveGroupAccess, type GroupAccess } from "./groups.access";
import { toGroupDto, toGroupSummaryDto, type GroupDto, type GroupMemberDto, type GroupSummaryDto } from "./groups.dto";
import {
  createGroupWithOwner,
  deleteMembership,
  findGroupBySlug,
  findGroupsForMember,
  findManagerIds,
  findMembers,
  findMembership,
  isSlugTaken,
  searchGroups,
  setMemberRole,
  setMembership,
  updateGroup,
  type GroupRow,
} from "./groups.repository";
import type {
  CreateGroupInput,
  ListGroupsQuery,
  ListMembersQuery,
  MemberActionInput,
  UpdateGroupInput,
} from "./groups.schema";

const ROLE_LABEL_FR = { OWNER: "propriétaire", ADMIN: "administrateur", MODERATOR: "modérateur", MEMBER: "membre" } as const;

export interface ActorContext {
  readonly user: AuthUser;
  readonly ip?: string;
}

export async function accessFor(group: GroupRow, viewer: AuthUser | null): Promise<GroupAccess> {
  const membership = viewer ? await findMembership(group.id, viewer.id) : null;
  return resolveGroupAccess(group, viewer, membership);
}

/** Load a live group with the viewer's access, or 404. */
export async function loadGroup(
  slug: string,
  viewer: AuthUser | null,
): Promise<{ group: GroupRow; access: GroupAccess }> {
  const group = await findGroupBySlug(slug);
  if (!group || group.deletedAt) throw new NotFoundError("This group does not exist.");
  return { group, access: await accessFor(group, viewer) };
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name).slice(0, 48) || "group";
  if (!(await isSlugTaken(base))) return base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = `${base}-${randomInt(1000, 99999)}`;
    if (!(await isSlugTaken(candidate))) return candidate;
  }
  return `group-${randomInt(10 ** 7, 10 ** 8)}`;
}

export async function createGroup(input: CreateGroupInput, actor: ActorContext): Promise<GroupDto> {
  await enforceThenRecord([{ key: rateLimitKey("group:create", actor.user.id), rule: RATE_LIMITS.groupCreate }]);

  await assertOwnPublicImage(input.coverImage, actor.user.id);
  const group = await createGroupWithOwner({
    slug: await uniqueSlug(input.name),
    name: input.name,
    description: input.description || null,
    privacy: input.privacy,
    requiresApproval: input.requiresApproval,
    coverImage: input.coverImage ?? null,
    ownerId: actor.user.id,
  });

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.groupCreated,
    targetType: "group",
    targetId: group.id,
    metadata: { privacy: group.privacy },
    ip: actor.ip ?? null,
  });

  return toGroupDto(group, await accessFor(group, actor.user));
}

export async function getGroup(slug: string, viewer: AuthUser | null): Promise<GroupDto> {
  const { group, access } = await loadGroup(slug, viewer);
  return toGroupDto(group, access);
}

export async function listGroups(query: ListGroupsQuery, viewer: AuthUser | null): Promise<GroupSummaryDto[]> {
  if (query.scope === "mine") {
    if (!viewer) return [];
    return (await findGroupsForMember(viewer.id, query.limit)).map(toGroupSummaryDto);
  }
  return (await searchGroups({ ...(query.q ? { q: query.q } : {}), take: query.limit })).map(toGroupSummaryDto);
}

export async function updateGroupSettings(
  slug: string,
  input: UpdateGroupInput,
  actor: ActorContext,
): Promise<GroupDto> {
  const { group, access } = await loadGroup(slug, actor.user);
  if (!access.canEditSettings) throw new ForbiddenError("Only group admins can change these settings.");

  if (input.coverImage) await assertOwnPublicImage(input.coverImage, actor.user.id);
  const updated = await updateGroup(group.id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.privacy !== undefined ? { privacy: input.privacy } : {}),
    ...(input.requiresApproval !== undefined ? { requiresApproval: input.requiresApproval } : {}),
    ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
  });

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.groupUpdated,
    targetType: "group",
    targetId: group.id,
    metadata: { changed: Object.keys(input) },
    ip: actor.ip ?? null,
  });

  return toGroupDto(updated, await accessFor(updated, actor.user));
}

export async function deleteGroup(slug: string, actor: ActorContext): Promise<void> {
  const { group, access } = await loadGroup(slug, actor.user);
  if (!access.canDelete) throw new ForbiddenError("Only the group owner can delete it.");

  await updateGroup(group.id, { deletedAt: new Date() });
  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.groupDeleted,
    targetType: "group",
    targetId: group.id,
    ip: actor.ip ?? null,
  });
}

/** Public group: join at once. Private group: a request the managers approve. */
export async function joinGroup(slug: string, actor: ActorContext): Promise<GroupDto> {
  const { group, access } = await loadGroup(slug, actor.user);
  if (access.status === "BANNED") throw new ForbiddenError("You cannot join this group.");
  if (access.isMember || access.status === "PENDING") return toGroupDto(group, access);

  await enforceThenRecord([{ key: rateLimitKey("group:join", actor.user.id), rule: RATE_LIMITS.conversation }]);

  // Open groups let people in at once; private ones, and public ones whose
  // admins ask for it, hold the request until a manager approves.
  const status = group.privacy === "PUBLIC" && !group.requiresApproval ? "ACTIVE" : "PENDING";
  await setMembership({ groupId: group.id, userId: actor.user.id, status, role: "MEMBER" });
  if (status === "ACTIVE") syncGroupRoom(actor.user.id, group.id, true);

  if (status === "PENDING") {
    for (const managerId of await findManagerIds(group.id)) {
      notifyInBackground(
        notifyGroupActivity({
          userId: managerId,
          title: `${actor.user.name} demande à rejoindre « ${group.name} »`,
          groupSlug: group.slug,
          path: `/groups/${encodeURIComponent(group.slug)}?tab=members`,
        }),
        { groupId: group.id },
      );
    }
  }

  const fresh = (await findGroupBySlug(slug)) ?? group;
  return toGroupDto(fresh, await accessFor(fresh, actor.user));
}

export async function leaveGroup(slug: string, actor: ActorContext): Promise<void> {
  const { group, access } = await loadGroup(slug, actor.user);
  if (access.role === "OWNER" && access.isMember) {
    throw new ConflictError("Transfer ownership or delete the group before leaving it.");
  }
  // A banned member cannot erase their ban by "leaving".
  if (access.status === "BANNED") return;
  await deleteMembership(group.id, actor.user.id);
  syncGroupRoom(actor.user.id, group.id, false);
}

export async function listMembers(
  slug: string,
  query: ListMembersQuery,
  viewer: AuthUser | null,
): Promise<GroupMemberDto[]> {
  const { group, access } = await loadGroup(slug, viewer);
  if (!access.canRead) throw new NotFoundError("This group does not exist.");
  // Requests and bans are management data, not part of the public roster.
  if (query.status !== "ACTIVE" && !access.canManageMembers) {
    throw new ForbiddenError("Only group managers can see this list.");
  }

  const rows = await findMembers(group.id, query.status, query.limit);
  return rows.map((row) => ({
    user: row.user,
    role: row.role,
    status: row.status,
    since: row.createdAt.toISOString(),
  }));
}

/** Approve/reject requests, remove/ban/unban, change roles — rank-checked. */
export async function actOnMember(
  slug: string,
  targetUserId: string,
  input: MemberActionInput,
  actor: ActorContext,
): Promise<void> {
  const { group, access } = await loadGroup(slug, actor.user);
  if (!access.canManageMembers) throw new ForbiddenError("Only group managers can manage members.");
  if (targetUserId === actor.user.id) throw new ForbiddenError("You cannot manage your own membership.");

  const target = await findMembership(group.id, targetUserId);
  if (!target) throw new NotFoundError("This person is not part of the group.");

  const allowed = canManageMember(
    access.isMember ? access.role : null,
    isAdmin(actor.user),
    target.role,
    input.action === "role" ? input.role : undefined,
  );
  if (!allowed) throw new ForbiddenError("You cannot manage someone at or above your own role.");

  switch (input.action) {
    case "approve":
      if (target.status !== "PENDING") throw new ConflictError("There is no pending request.");
      await setMembership({ groupId: group.id, userId: targetUserId, status: "ACTIVE" });
      syncGroupRoom(targetUserId, group.id, true);
      notifyInBackground(
        notifyGroupActivity({
          userId: targetUserId,
          title: `Votre demande pour « ${group.name} » a été acceptée`,
          groupSlug: group.slug,
        }),
        { groupId: group.id },
      );
      break;
    case "reject":
      if (target.status !== "PENDING") throw new ConflictError("There is no pending request.");
      await deleteMembership(group.id, targetUserId);
      break;
    case "remove":
      await deleteMembership(group.id, targetUserId);
      syncGroupRoom(targetUserId, group.id, false);
      break;
    case "ban":
      await setMembership({ groupId: group.id, userId: targetUserId, status: "BANNED", role: "MEMBER" });
      syncGroupRoom(targetUserId, group.id, false);
      break;
    case "unban":
      if (target.status !== "BANNED") throw new ConflictError("This person is not banned.");
      await deleteMembership(group.id, targetUserId);
      break;
    case "role":
      if (target.status !== "ACTIVE") throw new ConflictError("Only active members can be given a role.");
      await setMemberRole(group.id, targetUserId, input.role);
      notifyInBackground(
        notifyGroupActivity({
          userId: targetUserId,
          title: `Votre rôle dans « ${group.name} » est maintenant : ${ROLE_LABEL_FR[input.role]}`,
          groupSlug: group.slug,
        }),
        { groupId: group.id },
      );
      break;
  }

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.groupMemberChanged,
    targetType: "group",
    targetId: group.id,
    metadata: { userId: targetUserId, action: input.action, ...(input.action === "role" ? { role: input.role } : {}) },
    ip: actor.ip ?? null,
  });
}

/** A manager adds someone directly (an invitation that needs no approval). */
export async function addMember(slug: string, userId: string, actor: ActorContext): Promise<void> {
  const { group, access } = await loadGroup(slug, actor.user);
  if (!access.canManageMembers) throw new ForbiddenError("Only group managers can add members.");

  const user = await findActiveUserById(userId);
  if (!user) throw new NotFoundError("This person does not exist.");

  const existing = await findMembership(group.id, userId);
  if (existing?.status === "ACTIVE") return;
  if (existing?.status === "BANNED") throw new ConflictError("This person is banned from the group.");

  await enforceThenRecord([{ key: rateLimitKey("group:add", actor.user.id), rule: RATE_LIMITS.conversation }]);
  await setMembership({ groupId: group.id, userId, status: "ACTIVE", role: "MEMBER" });
  syncGroupRoom(userId, group.id, true);

  notifyInBackground(
    notifyGroupActivity({
      userId,
      title: `${actor.user.name} vous a ajouté au groupe « ${group.name} »`,
      groupSlug: group.slug,
    }),
    { groupId: group.id },
  );
}
