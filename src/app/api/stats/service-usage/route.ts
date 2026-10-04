import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { getServiceUsage } from "@/modules/stats/service-usage";

/** F98 — the ranking of the most used services, with what to read from it. */
export const GET = apiRoute({
  roles: STAFF_ROLES,
  query: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }),
  handler: async ({ query, auth }) => jsonOk({ data: await getServiceUsage(auth.user, query.days) }),
});
