/**
 * Group persistence. `memberCount` moves in the same transaction as the
 * membership row that changes it, and only ACTIVE rows count.
 */

import type { GroupMemberStatus, GroupRole, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

export const groupSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  privacy: true,
  requiresApproval: true,
  coverImage: true,
  ownerId: true,
  memberCount: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.GroupSelect;

export type GroupRow = Prisma.GroupGetPayload<{ select: typeof groupSelect }>;

export interface MembershipRow {
  readonly role: GroupRole;
  readonly status: GroupMemberStatus;
}

export async function findGroupBySlug(slug: string): Promise<GroupRow | null> {
  return prisma.group.findUnique({ where: { slug }, select: groupSelect });
}

export async function findGroupById(id: string): Promise<GroupRow | null> {
  return prisma.group.findUnique({ where: { id }, select: groupSelect });
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  return (await prisma.group.count({ where: { slug } })) > 0;
}

export async function findMembership(groupId: string, userId: string): Promise<MembershipRow | null> {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });
}

/** Membership of one user across many groups, in one query (feed rendering). */
export async function findMemberships(
  userId: string,
  groupIds: readonly string[],
): Promise<Map<string, MembershipRow>> {
  if (groupIds.length === 0) return new Map();
  const rows = await prisma.groupMember.findMany({
    where: { userId, groupId: { in: [...groupIds] } },
    select: { groupId: true, role: true, status: true },
  });
  return new Map(rows.map((row) => [row.groupId, { role: row.role, status: row.status }]));
}

export type GroupStaffRole = "OWNER" | "ADMIN" | "MODERATOR";

/**
 * Staff roles (owner/admin/moderator) of these users in these groups, keyed
 * `groupId:userId`. Plain members are left out: the UI only labels staff.
 */
export async function findStaffRoles(
  groupIds: readonly string[],
  userIds: readonly string[],
): Promise<Map<string, GroupStaffRole>> {
  if (groupIds.length === 0 || userIds.length === 0) return new Map();
  const rows = await prisma.groupMember.findMany({
    where: {
      groupId: { in: [...new Set(groupIds)] },
      userId: { in: [...new Set(userIds)] },
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "MODERATOR"] },
    },
    select: { groupId: true, userId: true, role: true },
  });
  return new Map(rows.map((row) => [`${row.groupId}:${row.userId}`, row.role as GroupStaffRole]));
}

/** Ids of groups the user is an active member of (main-feed scoping). */
export async function findActiveGroupIds(userId: string): Promise<string[]> {
  const rows = await prisma.groupMember.findMany({
    where: { userId, status: "ACTIVE", group: { deletedAt: null } },
    select: { groupId: true },
    take: 500,
  });
  return rows.map((row) => row.groupId);
}

export async function createGroupWithOwner(data: {
  slug: string;
  name: string;
  description: string | null;
  privacy: "PUBLIC" | "PRIVATE";
  requiresApproval: boolean;
  coverImage: string | null;
  ownerId: string;
}): Promise<GroupRow> {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({ data: { ...data, memberCount: 1 }, select: groupSelect });
    await tx.groupMember.create({
      data: { groupId: group.id, userId: data.ownerId, role: "OWNER", status: "ACTIVE" },
    });
    return group;
  });
}

export async function updateGroup(id: string, data: Prisma.GroupUpdateInput): Promise<GroupRow> {
  return prisma.group.update({ where: { id }, data, select: groupSelect });
}

/**
 * Move a membership to a new status/role, keeping `memberCount` exact: the
 * counter changes only when a row enters or leaves ACTIVE.
 */
export async function setMembership(input: {
  groupId: string;
  userId: string;
  status: GroupMemberStatus;
  role?: GroupRole;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
      select: { status: true },
    });

    await tx.groupMember.upsert({
      where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
      create: {
        groupId: input.groupId,
        userId: input.userId,
        status: input.status,
        role: input.role ?? "MEMBER",
      },
      update: { status: input.status, ...(input.role ? { role: input.role } : {}) },
    });

    const wasActive = before?.status === "ACTIVE";
    const isActive = input.status === "ACTIVE";
    if (wasActive !== isActive) {
      await tx.group.update({
        where: { id: input.groupId },
        data: { memberCount: { increment: isActive ? 1 : -1 } },
      });
    }
  });
}

export async function setMemberRole(groupId: string, userId: string, role: GroupRole): Promise<void> {
  await prisma.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { role } });
}

export async function deleteMembership(groupId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { status: true },
    });
    if (!before) return;
    await tx.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
    if (before.status === "ACTIVE") {
      await tx.group.update({ where: { id: groupId }, data: { memberCount: { decrement: 1 } } });
    }
  });
}

export const memberUserSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
} satisfies Prisma.UserSelect;

export async function findMembers(groupId: string, status: GroupMemberStatus, take: number) {
  return prisma.groupMember.findMany({
    where: { groupId, status, user: { banned: false } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    take,
    select: { role: true, status: true, createdAt: true, user: { select: memberUserSelect } },
  });
}

/** Managers to notify about a join request. */
export async function findManagerIds(groupId: string): Promise<string[]> {
  const rows = await prisma.groupMember.findMany({
    where: { groupId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
    take: 20,
  });
  return rows.map((row) => row.userId);
}

export async function searchGroups(args: { q?: string; take: number }): Promise<GroupRow[]> {
  return prisma.group.findMany({
    where: {
      deletedAt: null,
      ...(args.q ? { OR: [{ name: { contains: args.q } }, { description: { contains: args.q } }] } : {}),
    },
    orderBy: [{ memberCount: "desc" }, { createdAt: "desc" }],
    take: args.take,
    select: groupSelect,
  });
}

export async function findGroupsForMember(userId: string, take: number): Promise<GroupRow[]> {
  const rows = await prisma.groupMember.findMany({
    where: { userId, status: "ACTIVE", group: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    take,
    select: { group: { select: groupSelect } },
  });
  return rows.map((row) => row.group);
}
