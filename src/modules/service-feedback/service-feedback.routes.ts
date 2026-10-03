import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import { createServiceFeedbackSchema, feedbackRefParamSchema, listServiceFeedbackQuerySchema, updateServiceFeedbackSchema } from "./service-feedback.schema";
import { createServiceFeedback, listServiceFeedback, updateServiceFeedback } from "./service-feedback.service";

export const listServiceFeedbackRoute = apiRoute({
  query: listServiceFeedbackQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listServiceFeedback(query, auth.user)),
});

export const createServiceFeedbackRoute = apiRoute({
  body: createServiceFeedbackSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createServiceFeedback(body, auth.user, ip) }, 201),
});

export const updateServiceFeedbackRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: feedbackRefParamSchema,
  body: updateServiceFeedbackSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await updateServiceFeedback(params.reference, body, auth.user, ip) }),
});
