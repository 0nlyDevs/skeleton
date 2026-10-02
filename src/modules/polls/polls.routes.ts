import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { idSchema } from "@/lib/validate";

import { postIdParamSchema } from "../posts/posts.schema";
import { castBallot } from "./polls.service";

const ballotSchema = z.object({ optionIds: z.array(idSchema).min(1).max(6) });

/** PUT replaces the viewer's ballot; DELETE retracts it. */
export const castBallotRoute = apiRoute({
  params: postIdParamSchema,
  body: ballotSchema,
  handler: async ({ params, body, auth }) => jsonOk({ data: await castBallot(params.id, body.optionIds, auth.user) }),
});

export const retractBallotRoute = apiRoute({
  params: postIdParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await castBallot(params.id, [], auth.user) }),
});
