import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/errors";

import { listOfficialMessagesQuerySchema, officialMessageIdParamSchema, officialMessageInputSchema } from "./official-messages.schema";
import { getCurrentOfficialMessage, listOfficialMessages, publishOfficialMessage, withdrawOfficialMessage } from "./official-messages.service";

/** The message on screen is public; the history is for administrators. */
export const listOfficialMessagesRoute = publicRoute({
  query: listOfficialMessagesQuerySchema,
  handler: async ({ query, auth }) => {
    if (query.view === "current") return jsonOk({ data: await getCurrentOfficialMessage() });
    if (!auth) throw new ForbiddenError("Only the High Council can publish an official message.");
    return jsonOk({ data: await listOfficialMessages(auth.user) });
  },
});

export const publishOfficialMessageRoute = apiRoute({
  roles: ["ADMIN"],
  body: officialMessageInputSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await publishOfficialMessage(body, auth.user, ip) }, 201),
});

export const withdrawOfficialMessageRoute = apiRoute({
  roles: ["ADMIN"],
  params: officialMessageIdParamSchema,
  handler: async ({ params, auth, ip }) => jsonOk({ data: await withdrawOfficialMessage(params.id, auth.user, ip) }),
});
