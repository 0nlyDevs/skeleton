import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { idSchema } from "@/lib/validate";

import { blockUser, listBlocked, unblockUser } from "./blocks.service";

const params = z.object({ id: idSchema });

export const blockUserRoute = apiRoute({
  params,
  handler: async ({ params: { id }, auth }) => jsonOk(await blockUser(id, auth.user)),
});

export const unblockUserRoute = apiRoute({
  params,
  handler: async ({ params: { id }, auth }) => jsonOk(await unblockUser(id, auth.user)),
});

export const listBlockedRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await listBlocked(auth.user) }),
});
