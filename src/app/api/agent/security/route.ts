import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { listSecurityEvents } from "@/modules/security-events/security-events.service";

/** F100 — the latest security events, for city staff. */
export const GET = apiRoute({
  roles: STAFF_ROLES,
  query: z.object({ level: z.enum(["alert", "notice", "routine"]).optional() }),
  handler: async ({ query, auth }) => jsonOk({ data: await listSecurityEvents(auth.user, query.level) }),
});
