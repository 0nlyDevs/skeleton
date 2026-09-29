import { getMeRoute, updateMeRoute } from "@/modules/users/users.routes";

/**
 * A static segment, so it is matched before `/api/users/[id]`. That ordering is
 * what keeps `me` from being read as a user id.
 */
export const GET = getMeRoute;
export const PATCH = updateMeRoute;
