import { z } from "zod";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";

import { idSchema } from "@/lib/validate";
import { semanticSearch, similarPosts } from "@/modules/recommendations/recommendations.service";

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

export const semanticSearchRoute = publicRoute({
  query: z.object({ q: z.string().trim().min(2).max(200), limit: z.coerce.number().int().min(1).max(20).default(10) }),
  rateLimit: RATE_LIMITS.userSearch,
  rateLimitScope: "semantic-search",
  handler: async ({ query, auth }) => jsonOk({ data: await semanticSearch(query.q, auth?.user ?? null, query.limit) }),
});

export const similarPostsRoute = publicRoute({
  params: z.object({ id: idSchema }),
  rateLimit: RATE_LIMITS.userSearch,
  rateLimitScope: "similar-posts",
  handler: async ({ params, auth }) => jsonOk({ data: await similarPosts(params.id, auth?.user ?? null) }),
});
