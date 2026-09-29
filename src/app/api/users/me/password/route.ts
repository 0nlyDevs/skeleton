import { changePasswordRoute } from "@/modules/users/users.routes";

/** Requires the current password, and revokes every other session on success. */
export const POST = changePasswordRoute;
