/**
 * HTTP endpoints of the realtime relay, served by `server.ts` before Next.
 *
 *   POST /api/realtime/connect  → { transport: "socket" } or { transport: "relay", id, frames }
 *   POST /api/realtime/poll     { id, send: [{ e, a, k? }] } → { frames } (410 when the id is gone)
 *   POST /api/realtime/close    { id }
 *
 * Every call is a short request: no long-polling, so Apache's per-account
 * concurrency stays free for pages and API calls. CSRF: POST only, origin
 * checked against the allowed origins, JSON body only, bounded in size.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import { env } from "@/lib/env";
import { resolveClientIp } from "@/lib/http/client-ip";
import { logger } from "@/lib/logger";

import { authenticateHandshake } from "./auth";
import type { AppSocketServer } from "./handlers";
import { getRelayHub, relayPreferred, type RelayFrame } from "./relay";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS_PER_POLL = 50;
const MAX_CLIENTS_PER_IP = 60;
/** How long a poll may wait for the acknowledgements of the events it carried. */
const ACK_WAIT_MS = 1_500;

function send(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function originAllowed(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return false;
  return env.corsAllowedOrigins.includes(origin.replace(/\/+$/, ""));
}

function clientIp(request: IncomingMessage): string {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  return resolveClientIp(headers, env.trustProxy);
}

function isFrame(value: unknown): value is RelayFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as { e?: unknown; a?: unknown; k?: unknown };
  return typeof frame.e === "string" && frame.e.length <= 64 && Array.isArray(frame.a) && (frame.k === undefined || Number.isInteger(frame.k));
}

/** Returns `true` when the request was a relay request (and was answered). */
export async function handleRelayRequest(request: IncomingMessage, response: ServerResponse, io: AppSocketServer | null): Promise<boolean> {
  const url = request.url ?? "";
  if (!url.startsWith("/api/realtime/")) return false;
  const action = url.slice("/api/realtime/".length).split("?")[0];

  if (request.method !== "POST") {
    send(response, 405, { error: "method" });
    return true;
  }
  if (!originAllowed(request)) {
    send(response, 403, { error: "origin" });
    return true;
  }

  const hub = getRelayHub();
  const ip = clientIp(request);

  try {
    const body = (await readJson(request)) as { id?: unknown; send?: unknown };

    if (action === "connect") {
      if (!relayPreferred() && io) {
        send(response, 200, { transport: "socket" });
        return true;
      }
      if (hub.countForIp(ip) >= MAX_CLIENTS_PER_IP) {
        send(response, 429, { error: "rate_limited" });
        return true;
      }
      const identity = await authenticateHandshake(request.headers);
      const client = await hub.connect(identity, request.headers, ip);
      send(response, 200, { transport: "relay", id: client.id, frames: client.drain() });
      return true;
    }

    const id = typeof body.id === "string" ? body.id : "";

    if (action === "close") {
      const client = await hub.resume(id, ip, request.headers.cookie, () => authenticateHandshake(request.headers));
      if (client) hub.drop(client.id, "client namespace disconnect");
      send(response, 200, { ok: true });
      return true;
    }

    if (action === "poll") {
      const client = await hub.resume(id, ip, request.headers.cookie, () => authenticateHandshake(request.headers));
      if (!client) {
        send(response, 410, { error: "gone" });
        return true;
      }
      const events = Array.isArray(body.send) ? body.send.slice(0, MAX_EVENTS_PER_POLL).filter(isFrame) : [];
      const awaiting = new Set<number>();
      for (const frame of events) {
        if (frame.k !== undefined) awaiting.add(frame.k);
        client.dispatch(frame.e as string, frame.a, frame.k);
      }
      // Handlers are async (database work): give their acknowledgements a
      // moment so a send gets its answer in the same round trip.
      const frames: RelayFrame[] = [];
      const deadline = Date.now() + (awaiting.size > 0 ? ACK_WAIT_MS : 0);
      for (;;) {
        for (const frame of client.drain()) {
          frames.push(frame);
          if (frame.e === null && frame.k !== undefined) awaiting.delete(frame.k);
        }
        if (awaiting.size === 0 || Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      send(response, 200, { frames });
      return true;
    }

    send(response, 404, { error: "unknown" });
    return true;
  } catch (error) {
    logger.warn("relay request failed", { action, error });
    if (!response.headersSent) send(response, 400, { error: "bad_request" });
    return true;
  }
}
