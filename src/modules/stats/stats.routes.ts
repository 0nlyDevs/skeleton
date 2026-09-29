import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { getAdminOverview, getUserOverview } from "./stats.service";

export const userOverviewRoute = apiRoute({
  handler: async ({ auth }) => jsonOk(await getUserOverview(auth.user)),
});

/**
 * Staff may read the aggregate numbers (they need them for the moderation
 * workload); only admins may act on user accounts. Splitting those two levels is
 * what keeps a moderator from becoming a defacto admin.
 */
export const adminOverviewRoute = apiRoute({
  roles: STAFF_ROLES,
  handler: async () => jsonOk(await getAdminOverview()),
});
