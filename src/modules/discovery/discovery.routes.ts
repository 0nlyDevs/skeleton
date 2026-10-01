import { z } from "zod";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";

import { getSuggestions, listContacts, searchEverything } from "./discovery.service";

export const contactsRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await listContacts(auth.user) }),
});

export const suggestionsRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await getSuggestions(auth.user) }),
});

export const searchRoute = publicRoute({
  query: z.object({ q: z.string().max(80).default("") }),
  rateLimit: RATE_LIMITS.userSearch,
  rateLimitScope: "search",
  handler: async ({ query, auth }) => jsonOk({ data: await searchEverything(query.q, auth?.user ?? null) }),
});
