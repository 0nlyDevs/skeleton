import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonCreated, jsonOk, noContent } from "@/lib/api/response";

import {
  commentParamsSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  postCommentsParamsSchema,
  updateCommentSchema,
} from "./comments.schema";
import { createComment, deleteComment, editComment, listComments } from "./comments.service";

/** Public: a guest may read the thread of a published post. */
export const listCommentsRoute = publicRoute({
  params: postCommentsParamsSchema,
  query: listCommentsQuerySchema,
  handler: async ({ params, query, auth }) => jsonOk(await listComments(params.id, query, auth?.user ?? null)),
});

export const createCommentRoute = apiRoute({
  params: postCommentsParamsSchema,
  body: createCommentSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonCreated({ data: await createComment(params.id, body, { user: auth.user, ip }) }),
});

export const updateCommentRoute = apiRoute({
  params: commentParamsSchema,
  body: updateCommentSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonOk({ data: await editComment(params.id, body, { user: auth.user, ip }) }),
});

export const deleteCommentRoute = apiRoute({
  params: commentParamsSchema,
  handler: async ({ params, auth, ip }) => {
    await deleteComment(params.id, { user: auth.user, ip });
    return noContent();
  },
});
