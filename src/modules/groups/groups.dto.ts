import type { GroupAccess } from "./groups.access";
import type { GroupRow } from "./groups.repository";

export interface GroupSummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly privacy: "PUBLIC" | "PRIVATE";
  readonly coverImage: string | null;
  readonly memberCount: number;
}

export interface GroupDto extends GroupSummaryDto {
  readonly description: string | null;
  readonly createdAt: string;
  /** What the viewer may do here — rendering hints only; the server re-checks. */
  readonly viewer: GroupAccess;
}

export interface GroupMemberDto {
  readonly user: { id: string; name: string; username: string | null; image: string | null };
  readonly role: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";
  readonly status: "ACTIVE" | "PENDING" | "BANNED";
  readonly since: string;
}

export function toGroupSummaryDto(row: GroupRow): GroupSummaryDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    privacy: row.privacy,
    coverImage: row.coverImage,
    memberCount: row.memberCount,
  };
}

export function toGroupDto(row: GroupRow, viewer: GroupAccess): GroupDto {
  return {
    ...toGroupSummaryDto(row),
    // A private group's description is part of its public card (like a sign
    // on a closed door); posts and members are not.
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    viewer,
  };
}
