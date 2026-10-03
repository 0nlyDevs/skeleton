import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { getLocale } from "@/lib/i18n/server";

import { listServicesQuerySchema, serviceAvailabilityInputSchema, serviceInputSchema, serviceSlugParamSchema } from "./city-services.schema";
import { createService, getService, listServices, updateService } from "./city-services.service";
import { setServiceAvailability } from "./service-availability.service";

export const listServicesRoute = publicRoute({
  query: listServicesQuerySchema,
  handler: async ({ query, auth }) =>
    jsonOk({ data: await listServices({ q: query.q, category: query.category, includeInactive: query.includeInactive === "1" }, auth?.user ?? null, await getLocale()) }),
});

export const getServiceRoute = publicRoute({
  params: serviceSlugParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getService(params.slug, auth?.user ?? null, await getLocale()) }),
});

export const createServiceRoute = apiRoute({
  roles: ["ADMIN"],
  body: serviceInputSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createService(body, auth.user, ip) }, 201),
});

export const updateServiceRoute = apiRoute({
  roles: ["ADMIN"],
  params: serviceSlugParamSchema,
  body: serviceInputSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await updateService(params.slug, body, auth.user, ip) }),
});

/** F38 — agents report an interruption as soon as they learn of it; admins too. */
export const setServiceAvailabilityRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: serviceSlugParamSchema,
  body: serviceAvailabilityInputSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await setServiceAvailability(params.slug, body, auth.user, ip) }),
});
