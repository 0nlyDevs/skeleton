import { apiRoute } from "@/lib/api/route";
import { jsonCreated, jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { RATE_LIMITS } from "@/lib/rate-limit";

import {
  createReportSchema,
  listReportsQuerySchema,
  reportIdParamSchema,
  resolveReportSchema,
} from "./reports.schema";
import { createReportForActor, listReports, resolveReport } from "./reports.service";

export const createReportRoute = apiRoute({
  body: createReportSchema,
  rateLimit: RATE_LIMITS.report,
  handler: async ({ body, auth, ip }) =>
    jsonCreated(await createReportForActor(body, { user: auth.user, ip })),
});

export const listReportsRoute = apiRoute({
  roles: STAFF_ROLES,
  query: listReportsQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listReports(query, auth.user)),
});

export const resolveReportRoute = apiRoute({
  roles: STAFF_ROLES,
  params: reportIdParamSchema,
  body: resolveReportSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonOk(await resolveReport(params.id, body, { user: auth.user, ip })),
});
