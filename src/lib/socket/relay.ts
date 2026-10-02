/**
 * Realtime relay: Socket.IO semantics over short HTTP polls.
 *
 * Why it exists. On cPanel/Passenger (Hodifly) the app sits behind Apache,
 * which caps an account at about nine concurrent requests and corrupts
 * WebSocket upgrades (it chunk-encodes the switched stream). Socket.IO then
 * falls back to long-polling, where every open tab holds one of those nine
 * slots for good: a handful of visitors and every other request queues for
 * ten seconds and fails with Apache's 500.
 *
 * The relay keeps exactly the same event contract and the same server
 * handlers, but each tab talks to the server with quick POSTs (a few
 * milliseconds each, every one to four seconds, immediately when it has
 * something to send). A "virtual socket" lives in this process per tab: the
 * existing `onConnection` handlers attach to it unchanged, rooms work the same
 * way, and every broadcast (`getBroadcaster()`) reaches Socket.IO sockets and
 * relay sockets alike.
 *
 * Security mirrors the Socket.IO handshake: the session cookie is verified at
 * connect and re-verified periodically, the relay id is a 256-bit secret bound
 * to that identity and IP, clients idle for 45 s are dropped (firing the same
 * `disconnect` handlers), queues and payloads are bounded.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

import { logger } from "@/lib/logger";

import type { SocketIdentity } from "./auth";

type Listener = (...args: unknown[]) => void;

export interface RelayFrame {
  /** Event name, or `null` for an acknowledgement. */
  readonly e: string | null;
  readonly a: unknown[];
  /** Acknowledgement id the client is waiting on. */
  readonly k?: number;
}

const IDLE_TIMEOUT_MS = 45_000;
const REVALIDATE_MS = 60_000;
const MAX_QUEUE = 500;

export class RelayClient {
  readonly id: string;
  readonly rooms = new Set<string>();
  readonly data: { identity: SocketIdentity | null; ip: string };
  /** Hash of the session cookie at connect: a relay id only works with it. */
  readonly sessionHash: Buffer;
  readonly handshake: { headers: IncomingHttpHeaders; address: string };
  connected = true;
  lastSeen = Date.now();
  lastValidated = Date.now();
  private readonly listeners = new Map<string, Listener[]>();
  private queue: RelayFrame[] = [];

  constructor(
    private readonly hub: RelayHub,
    identity: SocketIdentity | null,
    ip: string,
    headers: IncomingHttpHeaders,
  ) {
    this.id = `relay_${randomBytes(32).toString("base64url")}`;
    this.rooms.add(this.id);
    this.data = { identity, ip };
    this.handshake = { headers, address: ip };
    this.sessionHash = sessionFingerprint(headers.cookie);
  }

  // --- the subset of the Socket.IO server-side socket API the handlers use ---

  join(room: string | readonly string[]): void {
    for (const name of typeof room === "string" ? [room] : room) this.rooms.add(name);
  }

  leave(room: string): void {
    if (room !== this.id) this.rooms.delete(room);
  }

  on(event: string, listener: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    this.push({ e: event, a: args });
    return true;
  }

  to(room: string | readonly string[]) {
    return this.hub.to(room).except(this.id);
  }

  disconnect(): this {
    this.hub.drop(this.id, "server namespace disconnect");
    return this;
  }

  // --- relay plumbing ---

  push(frame: RelayFrame): void {
    if (!this.connected) return;
    this.queue.push(frame);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
  }

  drain(): RelayFrame[] {
    const frames = this.queue;
    this.queue = [];
    return frames;
  }

  /** A client-sent event, with an acknowledgement when the client asked for one. */
  dispatch(event: string, args: unknown[], ackId: number | undefined): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    const callArgs = ackId === undefined ? args : [...args, (...result: unknown[]) => this.push({ e: null, a: result, k: ackId })];
    for (const handler of handlers) {
      try {
        handler(...callArgs);
      } catch (error) {
        logger.warn("relay handler failed", { event, error });
      }
    }
  }

  fireDisconnect(reason: string): void {
    this.connected = false;
    for (const handler of this.listeners.get("disconnect") ?? []) {
      try {
        handler(reason);
      } catch {
        // Cleanup handlers must never block the others.
      }
    }
    this.listeners.clear();
  }
}

interface Target {
  readonly rooms: readonly string[];
  readonly excepts: readonly string[];
}

/** `to(...)`/`in(...)` chains over relay clients, mirroring Socket.IO's broadcast operator. */
export class RelayOperator {
  constructor(
    private readonly hub: RelayHub,
    private readonly target: Target,
  ) {}

  except(room: string | readonly string[]): RelayOperator {
    return new RelayOperator(this.hub, { ...this.target, excepts: [...this.target.excepts, ...(typeof room === "string" ? [room] : room)] });
  }

  to(room: string | readonly string[]): RelayOperator {
    return new RelayOperator(this.hub, { ...this.target, rooms: [...this.target.rooms, ...(typeof room === "string" ? [room] : room)] });
  }

  private matching(): RelayClient[] {
    return this.hub.matching(this.target);
  }

  emit(event: string, ...args: unknown[]): boolean {
    for (const client of this.matching()) client.push({ e: event, a: args });
    return true;
  }

  socketsJoin(room: string | readonly string[]): void {
    for (const client of this.matching()) client.join(room);
  }

  socketsLeave(room: string): void {
    for (const client of this.matching()) client.leave(room);
  }

  disconnectSockets(): void {
    for (const client of this.matching()) this.hub.drop(client.id, "server disconnect");
  }
}

export class RelayHub {
  private readonly clients = new Map<string, RelayClient>();
  private onConnect: ((client: RelayClient) => Promise<void>) | null = null;
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), 10_000);
    this.sweeper.unref?.();
  }

  /** The same connection setup Socket.IO runs (`onConnection` in handlers.ts). */
  setConnectionHandler(handler: (client: RelayClient) => Promise<void>): void {
    this.onConnect = handler;
  }

  to(room: string | readonly string[]): RelayOperator {
    return new RelayOperator(this, { rooms: typeof room === "string" ? [room] : [...room], excepts: [] });
  }

  matching(target: Target): RelayClient[] {
    const result: RelayClient[] = [];
    for (const client of this.clients.values()) {
      if (!target.rooms.some((room) => client.rooms.has(room))) continue;
      if (target.excepts.some((room) => client.rooms.has(room))) continue;
      result.push(client);
    }
    return result;
  }

  broadcastAll(event: string, ...args: unknown[]): void {
    for (const client of this.clients.values()) client.push({ e: event, a: args });
  }

  roomSize(room: string): number {
    let size = 0;
    for (const client of this.clients.values()) if (client.rooms.has(room)) size += 1;
    return size;
  }

  get size(): number {
    return this.clients.size;
  }

  countForIp(ip: string): number {
    let count = 0;
    for (const client of this.clients.values()) if (client.data.ip === ip) count += 1;
    return count;
  }

  async connect(identity: SocketIdentity | null, headers: IncomingHttpHeaders, ip: string): Promise<RelayClient> {
    const client = new RelayClient(this, identity, ip, headers);
    this.clients.set(client.id, client);
    if (this.onConnect) await this.onConnect(client);
    return client;
  }

  /**
   * The client for a poll, or `null` when it is unknown, expired, or presented
   * from a different session or address (the id alone is not enough).
   */
  async resume(id: string, ip: string, cookie: string | undefined, revalidate: () => Promise<SocketIdentity | null>): Promise<RelayClient | null> {
    const client = this.clients.get(id);
    if (!client || !client.connected) return null;
    if (client.data.ip !== ip) return null;
    // The id is useless without the very session cookie that opened it.
    if (!timingSafeEqual(client.sessionHash, sessionFingerprint(cookie))) return null;
    if (Date.now() - client.lastValidated > REVALIDATE_MS) {
      const identity = await revalidate();
      if ((identity?.userId ?? null) !== (client.data.identity?.userId ?? null)) {
        this.drop(id, "session changed");
        return null;
      }
      client.lastValidated = Date.now();
    }
    client.lastSeen = Date.now();
    return client;
  }

  drop(id: string, reason: string): void {
    const client = this.clients.get(id);
    if (!client) return;
    this.clients.delete(id);
    client.fireDisconnect(reason);
  }

  private sweep(): void {
    const cutoff = Date.now() - IDLE_TIMEOUT_MS;
    for (const client of [...this.clients.values()]) {
      if (client.lastSeen < cutoff) this.drop(client.id, "transport close");
    }
  }
}

/** Hash of the auth session cookie(s) only, so unrelated cookies may change freely. */
export function sessionFingerprint(cookie: string | undefined): Buffer {
  const session = (cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => /session_token=/i.test(part))
    .sort()
    .join(";");
  return createHash("sha256").update(session).digest();
}

const HUB_KEY = "__webcupRelayHub";
type GlobalWithHub = typeof globalThis & { [HUB_KEY]?: RelayHub };

/** The process-wide hub (shared by `server.ts` and the Next route bundles). */
export function getRelayHub(): RelayHub {
  const holder = globalThis as GlobalWithHub;
  holder[HUB_KEY] ??= new RelayHub();
  return holder[HUB_KEY];
}

/** True when this process runs under Phusion Passenger (cPanel, Hodifly). */
export function runsUnderPassenger(): boolean {
  return Boolean(
    process.env.PASSENGER_APP_ENV ||
      process.env.IN_PASSENGER ||
      process.env.PASSENGER_BASE_URI ||
      (globalThis as { PhusionPassenger?: unknown }).PhusionPassenger,
  );
}

/** `REALTIME_TRANSPORT`: `relay`, `socket`, or `auto` (relay under Passenger). */
export function relayPreferred(): boolean {
  const mode = (process.env.REALTIME_TRANSPORT ?? "auto").toLowerCase();
  if (mode === "relay") return true;
  if (mode === "socket") return false;
  return runsUnderPassenger();
}
