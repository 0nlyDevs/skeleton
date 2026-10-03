"use client";

/**
 * Client side of the realtime layer: one object with the Socket.IO client API
 * the app uses (`on`, `off`, `emit` with acks, `timeout().emit`, `connect`,
 * `disconnect`, `connected`), backed by whichever transport the server picks.
 *
 *  * `socket` — a real Socket.IO client (WebSocket, falling back to polling);
 *  * `relay`  — short HTTP polls to `/api/realtime/*` (see `relay.ts` on the
 *    server): used behind hosts that cap concurrent requests and break
 *    WebSocket upgrades, such as cPanel/Passenger.
 *
 * The server answers `POST /api/realtime/connect` with the transport to use,
 * so the choice follows the deployment, not a build-time flag.
 */

import { io, type Socket } from "socket.io-client";

type Listener = (...args: unknown[]) => void;
type Ack = (...args: unknown[]) => void;

interface Frame {
  readonly e: string | null;
  readonly a: unknown[];
  readonly k?: number;
}

const RESERVED = new Set(["connect", "disconnect", "connect_error"]);
const ACTIVE_INTERVAL_MS = 1_000;
const IDLE_INTERVAL_MS = 2_500;
const HIDDEN_INTERVAL_MS = 6_000;
const ACTIVITY_WINDOW_MS = 15_000;
/**
 * A signed-out visitor only ever receives city-wide broadcasts (alerts), so
 * one poll every 20 s is enough; polling every second for them was most of a
 * public page's requests. Eco mode halves the pace for members too.
 */
const GUEST_INTERVAL_MS = 20_000;
const GUEST_HIDDEN_INTERVAL_MS = 60_000;
const ECO_FACTOR = 2;

let guestPace = false;

/** Called by the realtime provider whenever the signed-in viewer changes. */
export function setRealtimeGuest(guest: boolean): void {
  guestPace = guest;
}

export class HybridSocket {
  connected = false;
  id: string | undefined;
  private readonly listeners = new Map<string, Set<Listener>>();
  private mode: "pending" | "socket" | "relay" = "pending";
  private inner: Socket | null = null;
  private relayId: string | null = null;
  private outbox: Frame[] = [];
  private readonly acks = new Map<number, { resolve: Ack; timer: ReturnType<typeof setTimeout> | null; withError: boolean }>();
  private nextAck = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight = false;
  private stopped = true;
  private failures = 0;
  private lastActivity = 0;

  // --- public API (mirrors the Socket.IO client) ---

  on(event: string, listener: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(listener);
    return this;
  }

  off(event: string, listener?: Listener): this {
    if (!listener) this.listeners.delete(event);
    else this.listeners.get(event)?.delete(listener);
    return this;
  }

  removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    const last = args.at(-1);
    if (typeof last === "function") {
      this.send(event, args.slice(0, -1), last as Ack, null);
    } else {
      this.send(event, args, null, null);
    }
    return this;
  }

  timeout(ms: number): { emit: (event: string, ...args: unknown[]) => void } {
    return {
      emit: (event: string, ...args: unknown[]) => {
        const last = args.at(-1);
        if (typeof last === "function") this.send(event, args.slice(0, -1), last as Ack, ms);
        else this.send(event, args, null, ms);
      },
    };
  }

  connect(): this {
    if (!this.stopped) return this;
    this.stopped = false;
    if (this.mode === "socket") {
      this.inner?.connect();
      return this;
    }
    void this.handshake();
    return this;
  }

  disconnect(): this {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.mode === "socket") {
      this.inner?.disconnect();
    } else if (this.relayId) {
      const id = this.relayId;
      this.relayId = null;
      void fetch("/api/realtime/close", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }), keepalive: true }).catch(() => undefined);
      if (this.connected) {
        this.connected = false;
        this.fire("disconnect", "io client disconnect");
      }
    }
    return this;
  }

  // --- internals ---

  private fire(event: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      try {
        listener(...args);
      } catch (error) {
        console.error(error);
      }
    }
  }

  private send(event: string, args: unknown[], ack: Ack | null, timeoutMs: number | null): void {
    if (this.mode === "socket" && this.inner) {
      if (ack && timeoutMs !== null) this.inner.timeout(timeoutMs).emit(event, ...args, ack);
      else if (ack) this.inner.emit(event, ...args, ack);
      else this.inner.emit(event, ...args);
      return;
    }
    if (!this.connected && timeoutMs !== null && ack) {
      ack(new Error("operation has timed out"));
      return;
    }
    let k: number | undefined;
    if (ack) {
      k = this.nextAck++;
      const timer = timeoutMs !== null ? setTimeout(() => this.resolveAck(k as number, [new Error("operation has timed out")], true), timeoutMs) : null;
      this.acks.set(k, { resolve: ack, timer, withError: timeoutMs !== null });
    }
    this.outbox.push(k === undefined ? { e: event, a: args } : { e: event, a: args, k });
    this.lastActivity = Date.now();
    this.schedule(0);
  }

  private resolveAck(k: number, args: unknown[], isTimeout = false): void {
    const entry = this.acks.get(k);
    if (!entry) return;
    this.acks.delete(k);
    if (entry.timer) clearTimeout(entry.timer);
    if (isTimeout) entry.resolve(...args);
    else if (entry.withError) entry.resolve(null, ...args);
    else entry.resolve(...args);
  }

  private async handshake(): Promise<void> {
    try {
      const response = await fetch("/api/realtime/connect", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin" });
      if (!response.ok) throw new Error(`connect ${response.status}`);
      const body = (await response.json()) as { transport: "socket" | "relay"; id?: string; frames?: Frame[] };
      if (this.stopped) return;
      if (body.transport === "socket") {
        this.useSocketIo();
        return;
      }
      this.mode = "relay";
      this.relayId = body.id ?? null;
      this.id = this.relayId ?? undefined;
      this.failures = 0;
      this.connected = true;
      this.fire("connect");
      this.deliver(body.frames ?? []);
      this.schedule(0);
    } catch (error) {
      this.failures += 1;
      this.fire("connect_error", error);
      if (!this.stopped) this.schedule(Math.min(10_000, 1_000 * 2 ** Math.min(this.failures, 4)), true);
    }
  }

  private useSocketIo(): void {
    this.mode = "socket";
    const inner = io({
      path: "/api/socket",
      withCredentials: true,
      transports: ["polling", "websocket"],
      upgrade: true,
      tryAllTransports: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });
    this.inner = inner;
    inner.on("connect", () => {
      this.connected = true;
      this.id = inner.id;
      this.fire("connect");
    });
    inner.on("disconnect", (reason) => {
      this.connected = false;
      this.fire("disconnect", reason);
      if (reason === "io server disconnect" && !this.stopped) inner.connect();
    });
    inner.on("connect_error", (error) => this.fire("connect_error", error));
    inner.onAny((event: string, ...args: unknown[]) => {
      if (!RESERVED.has(event)) this.fire(event, ...args);
    });
  }

  private deliver(frames: readonly Frame[]): void {
    for (const frame of frames) {
      if (frame.e === null) {
        if (frame.k !== undefined) this.resolveAck(frame.k, frame.a);
        continue;
      }
      this.lastActivity = Date.now();
      this.fire(frame.e, ...frame.a);
    }
  }

  private interval(): number {
    const hidden = typeof document !== "undefined" && document.hidden;
    if (guestPace) return hidden ? GUEST_HIDDEN_INTERVAL_MS : GUEST_INTERVAL_MS;
    const eco = typeof document !== "undefined" && document.documentElement.hasAttribute("data-eco") ? ECO_FACTOR : 1;
    if (hidden) return HIDDEN_INTERVAL_MS * eco;
    return (Date.now() - this.lastActivity < ACTIVITY_WINDOW_MS ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS) * eco;
  }

  private schedule(delay: number, reconnect = false): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (reconnect || !this.relayId) void this.handshake();
      else void this.poll();
    }, delay);
  }

  private async poll(): Promise<void> {
    if (this.inflight || !this.relayId) return;
    this.inflight = true;
    const sending = this.outbox.splice(0);
    try {
      const response = await fetch("/api/realtime/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: this.relayId, send: sending }),
        credentials: "same-origin",
      });
      if (response.status === 410) {
        // The server forgot us (restart, idle, session change): reconnect.
        this.relayId = null;
        this.outbox.unshift(...sending.filter((frame) => frame.k === undefined));
        for (const frame of sending) if (frame.k !== undefined) this.resolveAck(frame.k, [new Error("operation has timed out")], true);
        this.connected = false;
        this.fire("disconnect", "transport close");
        this.inflight = false;
        this.schedule(0, true);
        return;
      }
      if (!response.ok) throw new Error(`poll ${response.status}`);
      const body = (await response.json()) as { frames?: Frame[] };
      this.failures = 0;
      this.deliver(body.frames ?? []);
    } catch {
      // Keep unacknowledged frames for the next attempt.
      this.outbox.unshift(...sending);
      this.failures += 1;
    } finally {
      this.inflight = false;
    }
    const backoff = this.failures > 0 ? Math.min(10_000, 1_000 * 2 ** Math.min(this.failures, 4)) : this.interval();
    this.schedule(this.outbox.length > 0 && this.failures === 0 ? 0 : backoff);
  }
}
