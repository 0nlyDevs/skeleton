import { z } from "zod";

import { paginationQuerySchema, sortOrderSchema } from "@/lib/pagination";

export const AUDIT_SORT_FIELDS = ["createdAt", "action"] as const;

/** Filters accepted by `GET /api/audit`. */
export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  /** Free-text match on the action name. */
  action: z.string().trim().max(80).optional(),
  userId: z.string().trim().max(64).optional(),
  targetType: z.string().trim().max(40).optional(),
  /** Inclusive lower bound, ISO date or `YYYY-MM-DD`. */
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  order: sortOrderSchema.default("desc"),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

/** Audit rows are created by the server, never accepted from a request. */
export const auditActions = {
  userRegistered: "user.registered",
  userSignedIn: "user.signed_in",
  signInFailed: "auth.sign_in_failed",
  signInLocked: "auth.sign_in_locked",
  userRoleChanged: "user.role_changed",
  userBanned: "user.banned",
  userUnbanned: "user.unbanned",
  userProfileUpdated: "user.profile_updated",
  userPasswordChanged: "user.password_changed",
  userTwoFactorEnabled: "user.two_factor_enabled",
  userTwoFactorDisabled: "user.two_factor_disabled",
  userSessionsRevoked: "user.sessions_revoked",
  passkeyAdded: "user.passkey_added",
  passkeyRemoved: "user.passkey_removed",
  dataExported: "user.data_exported",
  deviceConfirmed: "user.device_confirmed",
  deviceForgotten: "user.device_forgotten",
  postCreated: "post.created",
  postUpdated: "post.updated",
  postDeleted: "post.deleted",
  postRestored: "post.restored",
  reportCreated: "report.created",
  reportResolved: "report.resolved",
  reportDismissed: "report.dismissed",
  uploadCreated: "upload.created",
  featureFlagToggled: "feature_flag.toggled",
  commentDeleted: "comment.deleted",
  messageDeleted: "message.deleted",
  conversationCreated: "conversation.created",
  conversationMembersChanged: "conversation.members_changed",
  groupCreated: "group.created",
  groupUpdated: "group.updated",
  groupDeleted: "group.deleted",
  groupMemberChanged: "group.member_changed",
  postModerated: "post.moderated",
  messageEdited: "message.edited",
  userDeleted: "user.deleted",
  serviceChanged: "service.changed",
  announcementChanged: "announcement.changed",
  cityRequestChanged: "city_request.changed",
  webcupTriaged: "webcup.triaged",
  transportChanged: "transport.changed",
  pageCreated: "page.created",
  pageUpdated: "page.updated",
  pageDeleted: "page.deleted",
} as const;

export type AuditAction = (typeof auditActions)[keyof typeof auditActions];

/**
 * Administrative actions: what the city must be able to justify. They make up
 * the agents' history, grouped by area, and the retention cron never deletes
 * them (routine rows such as sign-ins are trimmed after 90 days).
 */
export const ADMIN_ACTION_CATEGORIES = {
  requests: [auditActions.cityRequestChanged],
  announcements: [auditActions.announcementChanged],
  services: [auditActions.serviceChanged],
  transports: [auditActions.transportChanged],
  accounts: [auditActions.userBanned, auditActions.userUnbanned, auditActions.userRoleChanged, auditActions.userSessionsRevoked, auditActions.userDeleted],
  moderation: [auditActions.reportResolved, auditActions.reportDismissed, auditActions.postModerated, auditActions.commentDeleted],
  feed: [auditActions.webcupTriaged],
  settings: [auditActions.featureFlagToggled],
} as const satisfies Record<string, readonly AuditAction[]>;

export type AdminActionCategory = keyof typeof ADMIN_ACTION_CATEGORIES;

export const ADMIN_ACTIONS: readonly AuditAction[] = Object.values(ADMIN_ACTION_CATEGORIES).flat();
