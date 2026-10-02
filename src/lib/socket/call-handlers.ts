/**
 * Call signalling over the authenticated socket. Every event is checked
 * against the server's call table: only the two participants may accept,
 * decline, hang up or relay SDP/ICE, and frames go to the other party's
 * personal room only.
 */

import { z } from "zod";

import { logger } from "@/lib/logger";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import {
  RING_TIMEOUT_MS,
  callsOf,
  ringingCallsFor,
  callsOfSocket,
  peerSocket,
  createCall,
  endCall,
  getCall,
  iceServersFor,
  isBusy,
  isParticipant,
} from "@/modules/calls/calls.service";
import { findRoomById, findRoomMembers } from "@/modules/messages/messages.repository";
import { createNotification } from "@/modules/notifications/notifications.service";
import type { AuthUser } from "@/types";

import { SOCKET_EVENTS, type CallAck, type CallEndedPayload } from "./events";
import type { AppSocket, AppSocketServer } from "./handlers";
import { localizeForSocket } from "./locale";
import { isOnline } from "./presence";
import { userRoom } from "./rooms";

const inviteSchema = z.object({ roomId: z.string().min(1).max(120), kind: z.enum(["audio", "video"]) });
const signalSchema = z.object({
  callId: z.string().uuid(),
  data: z.union([
    z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().min(1).max(20_000) }),
    z.object({
      type: z.literal("candidate"),
      candidate: z.object({
        candidate: z.string().max(2_000),
        sdpMid: z.string().max(64).nullable().optional(),
        sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
      }),
    }),
  ]),
});

function finish(io: AppSocketServer, callId: string, reason: CallEndedPayload["reason"]): void {
  const call = endCall(callId);
  if (!call) return;
  io.to([userRoom(call.callerId), userRoom(call.calleeId)]).emit(SOCKET_EVENTS.callEnded, { callId, reason });
}

export function registerCallHandlers(io: AppSocketServer, socket: AppSocket, user: AuthUser): void {
  // Someone called while this person was offline: a tab opening during the
  // ring window still rings.
  for (const call of ringingCallsFor(user.id)) {
    socket.emit(SOCKET_EVENTS.callIncoming, { callId: call.id, roomId: call.roomId, kind: call.kind, from: call.caller });
  }

  socket.on(SOCKET_EVENTS.callInvite, (payload, ack) => {
    void (async () => {
      const reply = (result: CallAck) => {
      if (typeof ack !== "function") return;
      ack(result.ok ? result : { ...result, message: localizeForSocket(socket, result.message) });
    };
      try {
        const parsed = inviteSchema.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, code: "VALIDATION_ERROR", message: "Invalid call." });
        await enforceThenRecord([{ key: rateLimitKey("call", user.id), rule: RATE_LIMITS.call }]);

        const room = await findRoomById(parsed.data.roomId);
        if (!room || room.type !== "DIRECT") return reply({ ok: false, code: "NOT_FOUND", message: "This conversation does not exist." });
        const members = await findRoomMembers(room.id);
        if (!members.some((member) => member.userId === user.id)) {
          return reply({ ok: false, code: "NOT_FOUND", message: "This conversation does not exist." });
        }
        const callee = members.find((member) => member.userId !== user.id);
        if (!callee) return reply({ ok: false, code: "NOT_FOUND", message: "Nobody to call." });
        if (isBusy(callee.userId) || isBusy(user.id)) return reply({ ok: false, code: "BUSY", message: "This person is already in a call." });

        const call = createCall({ roomId: room.id, kind: parsed.data.kind, callerId: user.id, calleeId: callee.userId, callerSocketId: socket.id, caller: { id: user.id, name: user.name, image: user.image } });
        call.timeout = setTimeout(() => {
          if (getCall(call.id)?.state !== "ringing") return;
          // Offline or away: it rings out, and they find a missed call.
          finish(io, call.id, "missed");
          void createNotification({
            userId: call.calleeId,
            type: "SYSTEM",
            title: `Appel manqué de ${user.name}`,
            link: `/messages?room=${encodeURIComponent(room.id)}`,
          }).catch(() => undefined);
        }, RING_TIMEOUT_MS);

        io.to(userRoom(callee.userId)).emit(SOCKET_EVENTS.callIncoming, {
          callId: call.id,
          roomId: room.id,
          kind: call.kind,
          from: { id: user.id, name: user.name, image: user.image },
        });
        reply({ ok: true, callId: call.id, iceServers: iceServersFor(user.id) });
      } catch (error) {
        const code = (error as { code?: string }).code ?? "INTERNAL_ERROR";
        logger.warn("call invite rejected", { code });
        reply({ ok: false, code, message: code === "RATE_LIMITED" ? "Too many calls. Please wait." : "The call could not start." });
      }
    })();
  });

  socket.on(SOCKET_EVENTS.callAccept, (callId, ack) => {
    const reply = (result: CallAck) => {
      if (typeof ack !== "function") return;
      ack(result.ok ? result : { ...result, message: localizeForSocket(socket, result.message) });
    };
    const call = getCall(callId);
    if (!call || call.calleeId !== user.id || call.state !== "ringing") {
      reply({ ok: false, code: "NOT_FOUND", message: "This call has ended." });
      return;
    }
    call.state = "active";
    call.calleeSocketId = socket.id;
    if (call.timeout) clearTimeout(call.timeout);
    call.timeout = null;
    // Other tabs of the callee stop ringing; the caller starts the offer.
    io.to(userRoom(call.calleeId)).except(socket.id).emit(SOCKET_EVENTS.callEnded, { callId: call.id, reason: "hangup" });
    io.to(call.callerSocketId).emit(SOCKET_EVENTS.callAccepted, { callId: call.id });
    reply({ ok: true, callId: call.id, iceServers: iceServersFor(user.id) });
  });

  socket.on(SOCKET_EVENTS.callDecline, (callId) => {
    const call = getCall(callId);
    if (call && isParticipant(call, user.id)) finish(io, call.id, "declined");
  });

  socket.on(SOCKET_EVENTS.callHangup, (callId) => {
    const call = getCall(callId);
    if (call && isParticipant(call, user.id)) finish(io, call.id, "hangup");
  });

  socket.on(SOCKET_EVENTS.callSignal, (payload) => {
    const parsed = signalSchema.safeParse(payload);
    if (!parsed.success) return;
    const call = getCall(parsed.data.callId);
    if (!call || call.state !== "active") return;
    // Only the two tabs in the call may talk to each other.
    const target = peerSocket(call, socket.id);
    if (target) io.to(target).emit(SOCKET_EVENTS.callSignal, parsed.data);
  });

  socket.on("disconnect", () => {
    // The tab that placed or answered a call is gone: the call is over. A
    // ringing call the user has not answered yet keeps ringing in other tabs.
    for (const call of callsOfSocket(socket.id)) finish(io, call.id, "hangup");
    setTimeout(() => {
      if (isOnline(user.id)) return;
      for (const call of callsOf(user.id)) finish(io, call.id, "hangup");
    }, 1_000);
  });
}
