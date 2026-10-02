import { z } from "zod";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk, requestLocale } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";

import { listMapPosts } from "../posts/posts.service";
import { reversePlace, searchPlaces } from "./places.service";

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

export const searchPlacesRoute = apiRoute({
  query: z.object({ q: z.string().trim().min(2).max(120) }),
  rateLimit: RATE_LIMITS.places,
  rateLimitScope: "places",
  handler: async ({ query, request }) => jsonOk({ data: await searchPlaces(query.q, requestLocale(request)) }),
});

export const reversePlaceRoute = apiRoute({
  query: z.object({ lat: latitude, lng: longitude, precision: z.enum(["exact", "town"]).default("exact") }),
  rateLimit: RATE_LIMITS.places,
  rateLimitScope: "places",
  handler: async ({ query, request }) => jsonOk({ data: await reversePlace(query.lat, query.lng, requestLocale(request), query.precision) }),
});

/** Posts with a place inside the visible map area (visibility-checked). */
export const mapPostsRoute = publicRoute({
  query: z
    .object({ south: latitude, west: longitude, north: latitude, east: longitude })
    .refine((box) => box.north >= box.south, "Invalid area."),
  rateLimit: RATE_LIMITS.userSearch,
  rateLimitScope: "map",
  handler: async ({ query, auth }) => jsonOk({ data: await listMapPosts(query, auth?.user ?? null) }),
});
