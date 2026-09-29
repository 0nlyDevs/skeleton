/**
 * Message HTTP handlers.
 *
 * `GET /api/messages` is not a convenience — it is the documented realtime
 * fallback. Passenger and reverse proxies on shared hosting sometimes strip the
 * `Upgrade` header, which kills WebSockets; the client then falls back to
 * polling this endpoint with `?since=<cursor>`. The same handler therefore has to
 * be as cheap as the socket path: one indexed range scan, no joins beyond the
 * sender.
 */

import { apiRoute } from "@/lib/api/route";
import { jsonCreated, jsonOk } from "@/lib/api/response";

import { listMessagesQuerySchema, sendMessageSchema } from "./messages.schema";
import { listMessages, listRooms, sendMessage } from "./messages.service";

export const listMessagesRoute = apiRoute({
  query: listMessagesQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listMessages(query, auth.user)),
});

export const listRoomsRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await listRooms(auth.user) }),
});

// The one-message-per-second rule lives in the service, not here, so the socket
// path and the HTTP path share a single counter instead of two that drift.
export const sendMessageRoute = apiRoute({
  body: sendMessageSchema,
  handler: async ({ body, auth }) => jsonCreated(await sendMessage(body, { user: auth.user })),
});
