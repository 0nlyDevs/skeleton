import type { PublicProfileRow, PublicUserRow } from "@/modules/users/users.repository";

export interface PublicProfileDto {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly displayUsername: string | null;
  readonly image: string | null;
  readonly bio: string | null;
  readonly createdAt: string;
  readonly followerCount: number;
  readonly followingCount: number;
  readonly isFollowing: boolean;
}

export interface SearchUserDto {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly image: string | null;
  readonly isFollowing: boolean;
}

export function toPublicProfileDto(row: PublicProfileRow, isFollowing: boolean): PublicProfileDto {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    displayUsername: row.displayUsername,
    image: row.image,
    bio: row.bio,
    createdAt: row.createdAt.toISOString(),
    followerCount: row._count.followers,
    followingCount: row._count.following,
    isFollowing,
  };
}

export function toSearchUserDto(row: PublicUserRow, isFollowing: boolean): SearchUserDto {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    image: row.image,
    isFollowing,
  };
}
