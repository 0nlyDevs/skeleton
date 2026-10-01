/**
 * User response shapes.
 *
 * There are three of them, and choosing the narrowest one is the whole point:
 *
 *   * `PublicUserDto`  — what one user may know about another: name and avatar.
 *   * `UserProfileDto` — what you may know about *yourself*, including email.
 *   * `UserAdminDto`   — what an admin needs to run the platform.
 *
 * Email addresses only ever leave the server through the profile and admin
 * shapes. That is the rule the "no other user's email appears in any API
 * response" gate is checking for.
 */

import { formatBirthDate } from "@/lib/validation/profile";
import type { Role } from "@/types";

import type { AdminUserRow, UserProfileRow } from "./users.repository";

export interface PublicUserDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
}

export interface UserProfileDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly displayUsername: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  /** `YYYY-MM-DD`; private, only ever returned to its owner and to admins. */
  readonly birthDate: string | null;
  readonly email: string;
  readonly image: string | null;
  readonly bio: string | null;
  readonly role: Role;
  readonly emailVerified: boolean;
  readonly twoFactorEnabled: boolean;
  readonly createdAt: string;
}

export interface AdminUserDto extends UserProfileDto {
  readonly banned: boolean;
  readonly banReason: string | null;
  readonly banExpires: string | null;
  readonly postCount: number;
}

export function toPublicUserDto(row: PublicUserDto): PublicUserDto {
  return { id: row.id, name: row.name, username: row.username, image: row.image };
}

export function toUserProfileDto(row: UserProfileRow): UserProfileDto {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    displayUsername: row.displayUsername,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: formatBirthDate(row.birthDate),
    email: row.email,
    image: row.image,
    bio: row.bio,
    role: row.role as Role,
    emailVerified: row.emailVerified,
    twoFactorEnabled: row.twoFactorEnabled,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminUserDto(row: AdminUserRow): AdminUserDto {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    displayUsername: row.displayUsername,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: formatBirthDate(row.birthDate),
    email: row.email,
    image: row.image,
    bio: row.bio,
    role: row.role as Role,
    emailVerified: row.emailVerified,
    twoFactorEnabled: row.twoFactorEnabled,
    createdAt: row.createdAt.toISOString(),
    banned: row.banned,
    banReason: row.banReason,
    banExpires: row.banExpires ? row.banExpires.toISOString() : null,
    postCount: row._count.posts,
  };
}
