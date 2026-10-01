import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";

import { followUserParamsSchema, publicUsernameParamsSchema, searchUsersQuerySchema } from "./follows.schema";
import { followUser, getPublicProfile, searchUsers, unfollowUser } from "./follows.service";

export const getPublicProfileRoute = publicRoute({
  params: publicUsernameParamsSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getPublicProfile(params.username, auth?.user ?? null) }),
});

export const searchUsersRoute = apiRoute({
  query: searchUsersQuerySchema,
  rateLimit: RATE_LIMITS.userSearch,
  handler: async ({ query, auth }) => jsonOk({ data: await searchUsers(query, auth.user) }),
});

export const followUserRoute = apiRoute({
  params: followUserParamsSchema,
  rateLimit: RATE_LIMITS.follow,
  rateLimitScope: "users:follow",
  handler: async ({ params, auth }) => jsonOk(await followUser(params.id, auth.user)),
});

export const unfollowUserRoute = apiRoute({
  params: followUserParamsSchema,
  rateLimit: RATE_LIMITS.follow,
  rateLimitScope: "users:follow",
  handler: async ({ params, auth }) => {
    await unfollowUser(params.id, auth.user);
    return jsonOk({ following: false });
  },
});
