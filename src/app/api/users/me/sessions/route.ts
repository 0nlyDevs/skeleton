import { revokeOtherSessionsRoute } from "@/modules/users/users.routes";

/** Sign out every device except the current one. */
export const DELETE = revokeOtherSessionsRoute;
