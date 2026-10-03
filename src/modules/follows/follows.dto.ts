import type { PublicProfileRow, SearchUserRow } from "@/modules/users/users.repository";

export interface PublicProfileDto {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly displayUsername: string | null;
  readonly image: string | null;
  readonly bio: string | null;
  readonly banner: string | null;
  readonly createdAt: string;
  readonly followerCount: number;
  readonly followingCount: number;
  readonly postCount: number;
  readonly isFollowing: boolean;
  /** The profile owner follows the viewer. */
  readonly followsYou: boolean;
  /** Both follow each other: shown as "Amis". */
  readonly isFriend: boolean;
  /** True when the viewer is looking at their own profile. */
  readonly isSelf: boolean;
  /** The viewer blocked this profile. */
  readonly viewerBlocked?: boolean;
}

/** One row of a followers/following list, with the viewer's relation to that person. */
export interface ConnectionDto {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly image: string | null;
  readonly isFollowing: boolean;
  readonly followsYou: boolean;
  readonly isFriend: boolean;
  readonly isSelf: boolean;
}

export interface SearchUserDto {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly image: string | null;
  /** Citizen, city agent or administrator, so residents can tell who is who. */
  readonly role: "USER" | "AGENT" | "ADMIN";
  readonly isFollowing: boolean;
}

export function toPublicProfileDto(row: PublicProfileRow, isFollowing: boolean, isSelf = false, followsYou = false): PublicProfileDto {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    displayUsername: row.displayUsername,
    image: row.image,
    bio: row.bio,
    banner: row.banner,
    createdAt: row.createdAt.toISOString(),
    followerCount: row._count.followers,
    followingCount: row._count.following,
    postCount: row._count.posts,
    isFollowing,
    followsYou,
    isFriend: isFollowing && followsYou,
    isSelf,
  };
}

export function toSearchUserDto(row: SearchUserRow, isFollowing: boolean): SearchUserDto {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    image: row.image,
    role: row.role,
    isFollowing,
  };
}
