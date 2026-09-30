/**
 * Post HTTP handlers.
 *
 * These are thin by construction: `apiRoute` has already authenticated the
 * caller, enforced roles and parsed the input, so each handler is one call into
 * the service plus a response. `app/api/posts/route.ts` re-exports them, keeping
 * the App Router surface free of logic.
 */

import { apiRoute } from "@/lib/api/route";
import { jsonCreated, jsonOk, noContent } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";

import {
  createPostSchema,
  listPostsQuerySchema,
  postIdParamSchema,
  updatePostSchema,
} from "./posts.schema";
import {
  createPostForActor,
  deletePostForActor,
  getPostForActor,
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
