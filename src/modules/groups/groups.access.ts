/**
 * Group permission matrix — pure, so it is unit-tested and shared by every
 * service that touches group content (posts, comments, members).
 *
 *   capability        | guest | non-member | MEMBER | MODERATOR | ADMIN | OWNER | platform staff
 *   read (public)     |  yes  |    yes     |  yes   |    yes    |  yes  |  yes  |      yes
 *   read (private)    |  no   |    no      |  yes   |    yes    |  yes  |  yes  |      yes
 *   post / comment    |  no   |    no      |  yes   |    yes    |  yes  |  yes  |      no*
 *   moderate content  |  no   |    no      |  no    |    yes    |  yes  |  yes  |      yes
 *   manage members    |  no   |    no      |  no    |   MEMBER  |  yes  |  yes  |   ADMIN only
 *   edit settings     |  no   |    no      |  no    |    no     |  yes  |  yes  |   ADMIN only
 *   delete group      |  no   |    no      |  no    |    no     |  no   |  yes  |   ADMIN only
 *
 * (*) staff act on content, they do not take part as members.
 * A BANNED or PENDING row grants nothing beyond what a non-member has.
 */

import type { AuthUser, Role } from "@/types";

export type GroupRoleName = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";
export type GroupStatusName = "ACTIVE" | "PENDING" | "BANNED";

export interface GroupAccess {
  readonly isMember: boolean;
  readonly role: GroupRoleName | null;
  readonly status: GroupStatusName | null;
  readonly canRead: boolean;
  readonly canPost: boolean;
  readonly canModerate: boolean;
  readonly canManageMembers: boolean;
  readonly canEditSettings: boolean;
  readonly canDelete: boolean;
}

const RANK: Record<GroupRoleName, number> = { MEMBER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 };

export function groupRoleRank(role: GroupRoleName): number {
  return RANK[role];
}

function isPlatformStaff(role: Role | undefined): boolean {
  return role === "AGENT" || role === "ADMIN";
}

export function resolveGroupAccess(
  group: { readonly privacy: "PUBLIC" | "PRIVATE"; readonly deletedAt: Date | null },
  viewer: Pick<AuthUser, "role"> | null,
  membership: { readonly role: GroupRoleName; readonly status: GroupStatusName } | null,
): GroupAccess {
  const active = membership?.status === "ACTIVE";
  const role = active ? membership.role : null;
  const rank = role ? RANK[role] : -1;
  const staff = isPlatformStaff(viewer?.role);
  const platformAdmin = viewer?.role === "ADMIN";
  const alive = group.deletedAt === null;

  return {
    isMember: active,
    role: membership?.role ?? null,
    status: membership?.status ?? null,
    canRead: alive && (group.privacy === "PUBLIC" || active || staff),
    canPost: alive && active,
    canModerate: alive && (rank >= RANK.MODERATOR || staff),
    canManageMembers: alive && (rank >= RANK.MODERATOR || platformAdmin),
    canEditSettings: alive && (rank >= RANK.ADMIN || platformAdmin),
    canDelete: alive && (rank === RANK.OWNER || platformAdmin),
  };
}

/**
 * May `actor` act on `target` within the group? A manager may only act on
 * someone strictly below them, and may never hand out a role at or above
 * their own. Platform admins act as owners.
 */
export function canManageMember(
  actorRole: GroupRoleName | null,
  actorIsPlatformAdmin: boolean,
  targetRole: GroupRoleName,
  newRole?: GroupRoleName,
): boolean {
  const actorRank = actorIsPlatformAdmin ? RANK.OWNER : actorRole ? RANK[actorRole] : -1;
  if (actorRank < RANK.MODERATOR) return false;
  if (targetRole === "OWNER") return false;
  if (RANK[targetRole] >= actorRank) return false;
  if (newRole && RANK[newRole] >= actorRank) return false;
  return true;
}
