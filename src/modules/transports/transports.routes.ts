import { apiRoute } from "@/lib/api/route";
import { jsonOk, noContent } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { transportLineIdSchema, transportLineInputSchema } from "./transports.schema";
import { createTransportLine, deleteTransportLine, listTransportLines, updateTransportLine } from "./transports.service";

export const listTransportLinesRoute = apiRoute({ roles: STAFF_ROLES, handler: async () => jsonOk({ data: await listTransportLines() }) });
export const createTransportLineRoute = apiRoute({ roles: STAFF_ROLES, body: transportLineInputSchema, handler: async ({ body }) => jsonOk({ data: await createTransportLine(body) }, 201) });
export const updateTransportLineRoute = apiRoute({ roles: STAFF_ROLES, params: transportLineIdSchema, body: transportLineInputSchema, handler: async ({ params, body }) => jsonOk({ data: await updateTransportLine(params.id, body) }) });
export const deleteTransportLineRoute = apiRoute({ roles: STAFF_ROLES, params: transportLineIdSchema, handler: async ({ params }) => { await deleteTransportLine(params.id); return noContent(); } });
