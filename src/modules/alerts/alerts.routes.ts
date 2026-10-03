import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk, requestLocale } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";

import {
  alertReachQuerySchema,
  alertSlugParamSchema,
  createAlertSchema,
  listAlertsQuerySchema,
} from "./alerts.schema";
import {
  countAlertReach,
  createCityAlert,
  getAlertsForViewer,
  getZoneStatuses,
  getCityAlert,
  getPersonalAlertGuidance,
  listCityAlerts,
  resolveCityAlert,
} from "./alerts.service";

export const listCityAlertsRoute = publicRoute({
  query: listAlertsQuerySchema,
  handler: async ({ query }) => jsonOk(await listCityAlerts(query)),
});

export const getCityAlertRoute = publicRoute({
  params: alertSlugParamSchema,
  handler: async ({ params }) => jsonOk({ data: await getCityAlert(params.slug) }),
});

export const createCityAlertRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  body: createAlertSchema,
  rateLimit: RATE_LIMITS.cityAlert,
  rateLimitScope: "city-alert:create",
  handler: async ({ body, auth, ip }) =>
    jsonOk({ data: await createCityAlert(body, auth.user, ip) }, 201),
});

export const resolveCityAlertRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: alertSlugParamSchema,
  rateLimit: RATE_LIMITS.cityAlert,
  rateLimitScope: "city-alert:resolve",
  handler: async ({ params, auth, ip }) =>
    jsonOk({ data: await resolveCityAlert(params.slug, auth.user, ip) }),
});

export const cityAlertRecommendationsRoute = apiRoute({
  params: alertSlugParamSchema,
  rateLimit: RATE_LIMITS.ai,
  rateLimitScope: "city-alert:recommendations",
  handler: async ({ params, auth, request }) =>
    jsonOk({ data: await getPersonalAlertGuidance(params.slug, auth.user, requestLocale(request)) }),
});

/** Public: the state of each district for the map (counts only, never who lives where). */
export const zoneStatusesRoute = publicRoute({
  handler: async () => jsonOk({ data: await getZoneStatuses() }),
});

/** Staff: how many residents an alert with this scope would reach, shown before publishing. */
export const alertReachRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  query: alertReachQuerySchema,
  handler: async ({ query }) => jsonOk({ data: { scope: query.scope, residents: await countAlertReach(query.scope) } }),
});

/** Signed-in: the active alerts that reach me, for the popup and the banner. */
export const alertsForMeRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await getAlertsForViewer(auth.user) }),
});
