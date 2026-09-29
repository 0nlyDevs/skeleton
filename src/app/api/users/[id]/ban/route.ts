import { updateUserBanRoute } from "@/modules/users/users.routes";

/** Admin-only. Banning also revokes the account's live sessions. */
export const PATCH = updateUserBanRoute;
