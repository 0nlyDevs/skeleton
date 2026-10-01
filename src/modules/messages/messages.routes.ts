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
import { jsonCreated, jsonOk, noContent } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";

import {
  addMemberSchema,
  createRoomSchema,
  deleteMessageQuerySchema,
  editMessageSchema,
  messageIdParamSchema,
  listMessagesQuerySchema,
  roomParamSchema,
  sendMessageSchema,
} from "./messages.schema";
import {
  addMemberToGroup,
  createGroup,
  deleteMessage,
  editMessage,
  getUnreadSummary,
  getOrCreateDirectRoom,
  getRoomMembersList,
  leaveGroupRoom,
  listMessages,
  listRooms,
  markRoomRead,
  sendMessage,
} from "./messages.service";

export const listMessagesRoute = apiRoute({
  query: listMessagesQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listMessages(query, auth.user)),
});

export const listRoomsRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await listRooms(auth.user) }),
});

export const createRoomRoute = apiRoute({
  body: createRoomSchema,
  // Opening an existing direct conversation goes through here too, so the
  // budget is generous; group creation is bounded separately in the service.
  rateLimit: RATE_LIMITS.openConversation,
  rateLimitScope: "messages:create-room",
  handler: async ({ body, auth }) => {
    if (body.type === "DIRECT") {
      const room = await getOrCreateDirectRoom(body.targetUserId as string, auth.user);
      return jsonCreated({ data: room });
    }

    const room = await createGroup(
      body.name ?? "New Group",
      body.memberIds ?? [],
      auth.user,
    );
    return jsonCreated({ data: room });
  },
});

export const markRoomReadRoute = apiRoute({
  params: roomParamSchema,
  handler: async ({ params, auth }) => {
    await markRoomRead(params.id, auth.user);
    return jsonOk({ read: true });
  },
});

export const getRoomMembersRoute = apiRoute({
  params: roomParamSchema,
  handler: async ({ params, auth }) => {
    const members = await getRoomMembersList(params.id, auth.user);
    return jsonOk({ data: members });
  },
});

export const addRoomMemberRoute = apiRoute({
  params: roomParamSchema,
  body: addMemberSchema,
  rateLimit: RATE_LIMITS.conversation,
  rateLimitScope: "messages:add-member",
  handler: async ({ params, body, auth }) => {
    await addMemberToGroup(params.id, body.userId, auth.user);
    return jsonOk({ added: true });
  },
});

export const leaveRoomRoute = apiRoute({
  params: roomParamSchema,
  handler: async ({ params, auth }) => {
    await leaveGroupRoom(params.id, auth.user);
    return jsonOk({ left: true });
  },
});

// The one-message-per-second rule lives in the service, not here, so the socket
// path and the HTTP path share a single counter instead of two that drift.
export const sendMessageRoute = apiRoute({
  body: sendMessageSchema,
  handler: async ({ body, auth }) => jsonCreated(await sendMessage(body, { user: auth.user })),
});

export const editMessageRoute = apiRoute({
  params: messageIdParamSchema,
  body: editMessageSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonOk({ data: await editMessage(params.id, body.content, { user: auth.user, ip }) }),
});

/** `DELETE /api/messages/:id?scope=me|everyone` */
export const deleteMessageRoute = apiRoute({
  params: messageIdParamSchema,
  query: deleteMessageQuerySchema,
  handler: async ({ params, query, auth, ip }) => {
    await deleteMessage(params.id, query.scope, { user: auth.user, ip });
    return noContent();
  },
});

export const unreadSummaryRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await getUnreadSummary(auth.user) }),
});
