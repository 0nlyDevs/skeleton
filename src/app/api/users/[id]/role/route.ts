import { updateUserRoleRoute } from "@/modules/users/users.routes";

/** Admin-only. Refuses self-edits, last-admin demotion and escalation above the caller's rank. */
export const PATCH = updateUserRoleRoute;
