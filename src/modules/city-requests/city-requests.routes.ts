import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import {
  cityRequestMessageSchema,
  cityRequestRefParamSchema,
  createCityRequestSchema,
  listCityRequestsQuerySchema,
  updateCityRequestSchema,
} from "./city-requests.schema";
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
  handler: async ({ params, body, auth }) => jsonOk({ data: await addCityRequestMessage(params.reference, body, auth.user) }),
});
