/**
 * WebRTC calls: ICE configuration and the signalling state machine.
 *
 * Media flows peer-to-peer (DTLS-SRTP encrypted by WebRTC itself); the server
 * only relays signalling between the two members of a direct conversation.
 * Every frame is checked against the call it claims to belong to, so a socket
 * can never inject SDP or ICE into someone else's call, and a call can only be
 * placed to the other member of a DIRECT room the caller belongs to.
 */

import { createHmac, randomUUID } from "node:crypto";

import { env } from "@/lib/env";

export interface IceServer {
  readonly urls: string | string[];
  readonly username?: string;
  readonly credential?: string;
}

/**
 * STUN for everyone; TURN (for strict NATs) with short-lived credentials from
 * coturn's REST scheme: username = `<expiry>:<userId>`, password =
 * base64(HMAC-SHA1(secret, username)). The secret never leaves the server.
 */
export function iceServersFor(userId: string): IceServer[] {
  const servers: IceServer[] = [
    { urls: env.WEBRTC_STUN_URLS.split(",").map((url) => url.trim()).filter(Boolean) },
  ];
  if (env.TURN_URL && env.TURN_SECRET) {
    const username = `${Math.floor(Date.now() / 1000) + 3_600}:${userId}`;
    const credential = createHmac("sha1", env.TURN_SECRET).update(username).digest("base64");
    servers.push({ urls: env.TURN_URL, username, credential });
  }
  return servers;
}

export type CallKind = "audio" | "video";
type CallState = "ringing" | "active";

export interface Call {
  readonly id: string;
  readonly roomId: string;
  readonly kind: CallKind;
  readonly callerId: string;
  readonly calleeId: string;
  /** The exact tabs in the call: signalling goes only to them, and closing one ends it. */
  readonly callerSocketId: string;
  calleeSocketId: string | null;
  state: CallState;
  readonly createdAt: number;
  timeout: ReturnType<typeof setTimeout> | null;
}

/** In-process call table (move to Redis with the Socket.IO adapter to scale out). */
const calls = new Map<string, Call>();

export const RING_TIMEOUT_MS = 45_000;

export function createCall(input: {
  roomId: string;
  kind: CallKind;
  callerId: string;
  calleeId: string;
  callerSocketId: string;
}): Call {
  const call: Call = { id: randomUUID(), state: "ringing", createdAt: Date.now(), timeout: null, calleeSocketId: null, ...input };
  calls.set(call.id, call);
  return call;
}

export function getCall(id: unknown): Call | undefined {
  return typeof id === "string" ? calls.get(id) : undefined;
}

export function endCall(id: string): Call | undefined {
  const call = calls.get(id);
  if (!call) return undefined;
  if (call.timeout) clearTimeout(call.timeout);
  calls.delete(id);
  return call;
}

export function isParticipant(call: Call, userId: string): boolean {
  return call.callerId === userId || call.calleeId === userId;
}

export function otherParty(call: Call, userId: string): string {
  return call.callerId === userId ? call.calleeId : call.callerId;
}

/** A user already ringing or talking is "busy". */
export function isBusy(userId: string): boolean {
  for (const call of calls.values()) if (isParticipant(call, userId)) return true;
  return false;
}

export function callsOf(userId: string): Call[] {
  return [...calls.values()].filter((call) => isParticipant(call, userId));
}

/** Calls that one socket (tab) is part of. */
export function callsOfSocket(socketId: string): Call[] {
  return [...calls.values()].filter((call) => call.callerSocketId === socketId || call.calleeSocketId === socketId);
}

/** The socket on the other end of an active call, from the point of view of `socketId`. */
export function peerSocket(call: Call, socketId: string): string | null {
  if (call.callerSocketId === socketId) return call.calleeSocketId;
  if (call.calleeSocketId === socketId) return call.callerSocketId;
  return null;
}
