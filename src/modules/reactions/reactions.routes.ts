import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import { reactionParamsSchema, setReactionSchema } from "./reactions.schema";
import { listReactors, reactToPost, removeReaction } from "./reactions.service";

export const listReactorsRoute = publicRoute({
  params: reactionParamsSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await listReactors(params.id, auth?.user ?? null) }),
});

/** PUT is idempotent by design: sending the same reaction twice changes nothing. */
export const setReactionRoute = apiRoute({
  params: reactionParamsSchema,
  body: setReactionSchema,
  handler: async ({ params, body, auth }) => jsonOk({ data: await reactToPost(params.id, body.type, auth.user) }),
});

export const removeReactionRoute = apiRoute({
  params: reactionParamsSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await removeReaction(params.id, auth.user) }),
});
