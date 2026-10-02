import { type Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

/**
 * The profile projection. `password` lives on `Account`, not `User`, so there is
 * no hash to exclude here — but `banReason` and other moderation fields are
 * still left out of the self-view, because a user does not need the moderator's
 * notes.
 */
export const userProfileSelect = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  birthDateEncrypted: true,
  email: true,
  image: true,
  bio: true,
  banner: true,
  role: true,
  emailVerified: true,
  twoFactorEnabled: true,
  createdAt: true,
  showPresence: true,
  usernameChangedAt: true,
  autoLocation: true,
} satisfies Prisma.UserSelect;

export const adminUserSelect = {
  ...userProfileSelect,
  banned: true,
  banReason: true,
  banExpires: true,
  _count: { select: { posts: true } },
} satisfies Prisma.UserSelect;

export type UserProfileRow = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;

export type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

export const publicProfileSelect = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  image: true,
  bio: true,
  banner: true,
  createdAt: true,
  _count: {
    select: {
      followers: true,
      following: true,
      posts: { where: { published: true, deletedAt: null, groupId: null } },
    },
  },
} satisfies Prisma.UserSelect;

export type PublicProfileRow = Prisma.UserGetPayload<{ select: typeof publicProfileSelect }>;

export const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
} satisfies Prisma.UserSelect;

export type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export interface FindUsersArgs {
  readonly where: Prisma.UserWhereInput;
  readonly orderBy: Prisma.UserOrderByWithRelationInput;
  readonly skip: number;
  readonly take: number;
}

export async function findUsers(args: FindUsersArgs): Promise<AdminUserRow[]> {
  return prisma.user.findMany({
    where: args.where,
    orderBy: args.orderBy,
    skip: args.skip,
    take: args.take,
    select: adminUserSelect,
  });
}

export async function countUsers(where: Prisma.UserWhereInput): Promise<number> {
  return prisma.user.count({ where });
}

export async function findUserProfileById(id: string): Promise<UserProfileRow | null> {
  return prisma.user.findUnique({ where: { id }, select: userProfileSelect });
}

export async function findAdminUserById(id: string): Promise<AdminUserRow | null> {
  return prisma.user.findUnique({ where: { id }, select: adminUserSelect });
}

export async function updateUserProfile(
  id: string,
  data: Prisma.UserUncheckedUpdateInput,
): Promise<UserProfileRow> {
  return prisma.user.update({ where: { id }, data, select: userProfileSelect });
}

export async function updateUserRoleAdmin(id: string, role: Prisma.UserUpdateInput["role"]) {
  return prisma.user.update({ where: { id }, data: { role }, select: adminUserSelect });
}

export async function updateUserBan(
  id: string,
  data: { banned: boolean; banReason: string | null; banExpires: Date | null },
): Promise<AdminUserRow> {
  return prisma.user.update({ where: { id }, data, select: adminUserSelect });
}

export async function findUserIdByUsername(username: string): Promise<string | null> {
  const row = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  return row?.id ?? null;
}

export async function findActiveUserById(id: string): Promise<PublicUserRow | null> {
  return prisma.user.findFirst({
    where: { id, banned: false },
    select: publicUserSelect,
  });
}

export async function findActiveUsersByIds(ids: readonly string[]): Promise<PublicUserRow[]> {
  if (ids.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: [...ids] }, banned: false },
    select: publicUserSelect,
  });
}

export async function findActivePublicProfileByUsername(username: string): Promise<PublicProfileRow | null> {
  return prisma.user.findFirst({
    where: { username, banned: false },
    select: publicProfileSelect,
  });
}

/** Search public identities only; emails are intentionally not searchable here. */
export async function searchActivePublicUsers(
  query: string,
  excludedUserId: string,
  take: number,
): Promise<PublicUserRow[]> {
  return prisma.user.findMany({
    where: {
      banned: false,
      id: { not: excludedUserId },
      username: { not: null },
      OR: [
        { name: { contains: query } },
        { username: { contains: query } },
        { displayUsername: { contains: query } },
      ],
    },
    orderBy: [{ username: "asc" }, { id: "asc" }],
    take,
    select: publicUserSelect,
  });
}

export async function findFollowingIds(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId, following: { banned: false } },
    select: { followingId: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });
  return rows.map((row) => row.followingId);
}

export async function findFollowingTargetIds(userId: string, targetIds: readonly string[]): Promise<string[]> {
  if (targetIds.length === 0) return [];
  const rows = await prisma.follow.findMany({
    where: { followerId: userId, followingId: { in: [...targetIds] } },
    select: { followingId: true },
  });
  return rows.map((row) => row.followingId);
}

/** Resolve mentioned handles to active accounts in one query. */
export async function findActiveUsersByUsernames(
  usernames: readonly string[],
): Promise<Array<{ id: string; username: string | null }>> {
  if (usernames.length === 0) return [];
  return prisma.user.findMany({
    where: { username: { in: [...usernames] }, banned: false },
    select: { id: true, username: true },
  });
}

/** Used to refuse an action that would leave the platform without an admin. */
export async function countAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "ADMIN", banned: false } });
}

export async function countUsersByRole(): Promise<Record<string, number>> {
  const rows = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.role, row._count._all]));
}

export async function findRecentUsers(take: number): Promise<AdminUserRow[]> {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: adminUserSelect,
  });
}

/**
 * Revoke one of the caller's own sessions. Ownership is part of the `where`
 * clause, so another user's session id simply matches nothing.
 */
export async function deleteOwnSession(userId: string, sessionId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { id: sessionId, userId } });
  return count;
}

/** Revoke every session of the user except the one making the request. */
export async function deleteOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { userId, id: { not: keepSessionId } },
  });
  return count;
}

/** Revoke every session for a user, e.g. immediately after a ban. */
export async function deleteUserSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

export async function countCredentialAccounts(userId: string): Promise<number> {
  return prisma.account.count({ where: { userId, providerId: "credential", password: { not: null } } });
}
