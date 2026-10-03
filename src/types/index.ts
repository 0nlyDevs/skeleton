/**
 * Shared application types.
 *
 * This module must stay free of runtime dependencies — no Prisma, no Node APIs
 * — because client components import from it. Prisma's generated `Role` enum is
 * structurally identical to the union below, so values flow between the two
 * without a cast.
 */

export const ROLES = ["USER", "AGENT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const NOTIFICATION_TYPES = [
  "NEW_MESSAGE",
  "MENTION",
  "SYSTEM",
  "ROLE_CHANGED",
  "POST_COMMENT",
  "COMMENT_REPLY",
  "POST_REACTION",
  "NEW_FOLLOWER",
  "GROUP_INVITE",
  "MODERATION",
  "GROUP_ACTIVITY",
  "POST_SHARE",
  "SECURITY",
  "CITY_REQUEST",
  "ANNOUNCEMENT",
  "ALERT",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REACTION_TYPES = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

/** Per-type reaction totals; a missing key means zero. */
export type ReactionCounts = Partial<Record<ReactionType, number>>;

export const ROOM_TYPES = ["GLOBAL", "POST", "DIRECT", "GROUP"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

/**
 * The authenticated user as the client is allowed to see it. Field-for-field
 * this is the whitelist returned by every API response; anything not listed
 * here must never leave the server.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Public handle; `null` only for rows that predate the profile migration. */
  readonly username: string | null;
  readonly image: string | null;
  readonly role: Role;
  readonly emailVerified: boolean;
  readonly twoFactorEnabled: boolean;
  readonly createdAt: string;
}

export interface AuthSessionInfo {
  readonly id: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}

/** Server-side auth context. Never serialized wholesale. */
export interface AuthContext {
  readonly user: AuthUser;
  readonly session: AuthSessionInfo;
}

/** The error contract, mirrored for client-side narrowing. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface ListMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly meta: ListMeta;
}

/** Result of any form submission, shaped for `useActionState` / toasts. */
export interface FormState {
  readonly status: "idle" | "success" | "error";
  readonly message?: string;
  readonly fields?: Record<string, string>;
}

export const IDLE_FORM_STATE: FormState = { status: "idle" };

/** A file stored by the upload module, as returned to the client. */
export interface UploadedFile {
  readonly id: string;
  readonly url: string;
  readonly originalName: string;
  readonly mime: string;
  readonly size: number;
  readonly createdAt: string;
}
