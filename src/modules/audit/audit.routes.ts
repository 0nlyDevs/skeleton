import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { ADMIN_ROLES } from "@/lib/auth/roles";

import { listAuditLogsQuerySchema } from "./audit.schema";
import { listAuditActions, listAuditLogs } from "./audit.service";

export const listAuditLogsRoute = apiRoute({
  roles: ADMIN_ROLES,
  query: listAuditLogsQuerySchema,
  handler: async ({ query }) => jsonOk(await listAuditLogs(query)),
});

/** Distinct actions present in the trail, for the filter dropdown. */
export const listAuditActionsRoute = apiRoute({
  roles: ADMIN_ROLES,
  handler: async () => jsonOk({ data: await listAuditActions() }),
});
