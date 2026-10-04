import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import {
  cityRequestMessageSchema,
  cityRequestRefParamSchema,
  createCityRequestSchema,
  receiptCheckQuerySchema,
  listCityRequestsQuerySchema,
  listReportsQuerySchema,
  similarReportsQuerySchema,
  updateCityRequestSchema,
} from "./city-requests.schema";
import { listReports, similarReports, supportReport, withdrawReportSupport } from "./city-requests.reports";
import { checkReceipt } from "./city-requests.receipt";
import { addCityRequestMessage, createCityRequest, getCityRequest, listCityRequests, updateCityRequest } from "./city-requests.service";

export const listCityRequestsRoute = apiRoute({
  query: listCityRequestsQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listCityRequests(query, auth.user)),
});

export const createCityRequestRoute = apiRoute({
  body: createCityRequestSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createCityRequest(body, auth.user, ip) }, 201),
});

export const getCityRequestRoute = apiRoute({
  params: cityRequestRefParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getCityRequest(params.reference, auth.user) }),
});

export const updateCityRequestRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: cityRequestRefParamSchema,
  body: updateCityRequestSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await updateCityRequest(params.reference, body, auth.user, ip) }),
});

export const addCityRequestMessageRoute = apiRoute({
  params: cityRequestRefParamSchema,
  body: cityRequestMessageSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await addCityRequestMessage(params.reference, body, auth.user, ip) }),
});

/** F52 — the public board of reported problems (no name, no message). */
export const listReportsRoute = publicRoute({
  query: listReportsQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listReports(query, auth?.user ?? null)),
});

/** F52 — open reports near a new one, to offer support instead of a duplicate. */
export const similarReportsRoute = publicRoute({
  query: similarReportsQuerySchema,
  handler: async ({ query, auth }) => jsonOk({ data: await similarReports(query, auth?.user ?? null) }),
});

/** F52 — "Je suis aussi concerné": back a report, once per resident. */
export const supportReportRoute = apiRoute({
  params: cityRequestRefParamSchema,
  handler: async ({ params, auth, ip }) => jsonOk({ data: await supportReport(params.reference, auth.user, ip) }),
});

export const withdrawReportSupportRoute = apiRoute({
  params: cityRequestRefParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await withdrawReportSupport(params.reference, auth.user) }),
});

/** F83 — anyone holding a receipt can check it; the answer carries nothing personal. */
export const checkReceiptRoute = publicRoute({
  query: receiptCheckQuerySchema,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ query }) => jsonOk({ data: await checkReceipt(query.reference, query.code) }),
});
