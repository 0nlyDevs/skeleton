/**
 * Post HTTP handlers.
 *
 * These are thin by construction: `apiRoute` has already authenticated the
 * caller, enforced roles and parsed the input, so each handler is one call into
 * the service plus a response. `app/api/posts/route.ts` re-exports them, keeping
 * the App Router surface free of logic.
 */

import { apiRoute, publicRoute } from "@/lib/api/route";
import { rankForYou } from "@/modules/recommendations/recommendations.service";
import { jsonCreated, jsonOk, noContent } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { UnauthenticatedError } from "@/lib/errors";

import { getFollowingIds } from "../follows/follows.service";

import {
  createPostSchema,
  feedQuerySchema,
  listPostsQuerySchema,
  postIdParamSchema,
  updatePostSchema,
} from "./posts.schema";
import { recordMessageShare,
  createPostForActor,
  deletePostForActor,
  getFeedItem,
  getPostForActor,
  listFeed,
  listPosts,
  restorePostForActor,
  updatePostForActor,
} from "./posts.service";

export const listPostsRoute = apiRoute({
  query: listPostsQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listPosts(query, auth.user)),
});

export const createPostRoute = apiRoute({
  body: createPostSchema,
  handler: async ({ body, auth, ip }) =>
    jsonCreated({ data: await createPostForActor(body, { user: auth.user, ip }) }),
});

export const getPostRoute = apiRoute({
  params: postIdParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getPostForActor(params.id, auth.user) }),
});

export const updatePostRoute = apiRoute({
  params: postIdParamSchema,
  body: updatePostSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonOk({ data: await updatePostForActor(params.id, body, { user: auth.user, ip }) }),
});

export const deletePostRoute = apiRoute({
  params: postIdParamSchema,
  handler: async ({ params, auth, ip }) => {
    await deletePostForActor(params.id, { user: auth.user, ip });
    return noContent();
  },
});

export const restorePostRoute = apiRoute({
  params: postIdParamSchema,
  roles: STAFF_ROLES,
  handler: async ({ params, auth, ip }) =>
    jsonOk({ data: await restorePostForActor(params.id, { user: auth.user, ip }) }),
});

/** Public: guests read the feed; signed-in viewers also see their own reactions. */
export const listFeedRoute = publicRoute({
  query: feedQuerySchema,
  handler: async ({ query, auth }) => {
    if (query.scope === "for_you") {
      if (!auth) return jsonOk(await listFeed({ ...query, scope: "all" }, null));
      const offset = query.cursor?.startsWith("r:") ? Number(query.cursor.slice(2)) || 0 : 0;
      return jsonOk(await rankForYou(auth.user, Math.min(offset, 400), query.limit));
    }
    if (query.scope === "following") {
      if (!auth) throw new UnauthenticatedError();
      const followingIds = await getFollowingIds(auth.user.id);
      return jsonOk(await listFeed(query, auth.user, followingIds));
    }
    return jsonOk(await listFeed(query, auth?.user ?? null));
  },
});

export const getFeedItemRoute = publicRoute({
  params: postIdParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getFeedItem(params.id, auth?.user ?? null) }),
});

/** `POST /api/posts/:id/shares` — the post was sent into conversations. */
export const recordMessageShareRoute = apiRoute({
  params: postIdParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await recordMessageShare(params.id, auth.user) }),
});

