/**
 * Custom application server.
 *
 * Next.js alone cannot host a WebSocket endpoint, so the app runs behind a plain
 * `node:http` server that Next handles and Socket.IO shares. Both live on the same
 * port, which is the only configuration that works behind cPanel/Passenger:
 * exactly one port is proxied to the application, and a second listener would not
 * be reachable.
 *
 * Started by PM2 in production (see `ecosystem.config.js`) and by `npm run dev`
 * in development. `npm run build` still uses the Next CLI.
 *
 * `.env` is loaded by the npm script's `--env-file-if-exists` flag rather than
 * here, because ES module imports are hoisted: a loader inside this file would
 * run *after* the modules that read `process.env`.
 */

import { createServer } from "node:http";

import { installFileLog } from "./src/lib/file-log";
import { recoverReleaseUploads } from "./src/lib/storage/disk";
import { startWebcupPoller } from "./src/modules/webcup/webcup.poller";

import next from "next";

import { env } from "./src/lib/env";
import { logger } from "./src/lib/logger";
import { acceptRelayClient, type AppSocketServer } from "./src/lib/socket/handlers";
import { getRelayHub, relayPreferred } from "./src/lib/socket/relay";
import { handleRelayRequest } from "./src/lib/socket/relay-http";
import { attachRealtimeServer } from "./src/lib/socket/server";

const dev = !env.isProduction;
const hostname = process.env.HOST ?? "0.0.0.0";
const port = env.PORT;

const logFile = env.isProduction ? installFileLog() : null;

async function main(): Promise<void> {
  if (logFile) logger.warn("server log mirrored to file", { file: logFile });
  void recoverReleaseUploads()
    .then((count) => count > 0 && logger.warn("recovered uploads from earlier releases", { count }))
    .catch((error: unknown) => logger.warn("upload recovery failed", { error }));
  const app = next({ dev, hostname, port });
  await app.prepare();

  const handle = app.getRequestHandler();

  let io: AppSocketServer | null = null;
  const server = createServer((request, response) => {
    /*
     * Publish the socket address to the application.
     *
     * A direct connection has no `X-Forwarded-For`, so without this the app
     * cannot tell clients apart and every rate limit collapses onto one shared
     * "unknown" bucket — five sign-ins from anyone locks out everyone.
     *
     * Assigned, never defaulted: this process is the trusted source of the
     * socket address, so a client-sent `x-connection-ip` must be discarded
     * rather than believed.
     */
    if (request.socket.remoteAddress) {
      request.headers["x-connection-ip"] = request.socket.remoteAddress;
    }

    // Realtime relay (short polls): answered here, before Next, so it costs
    // a few milliseconds and never goes through page rendering.
    if (!io && request.url?.startsWith("/api/socket")) {
      response.writeHead(410, { "Content-Type": "application/json", "Cache-Control": "no-store", Connection: "close" });
      response.end('{"error":"realtime moved to /api/realtime"}');
      return;
    }
    if (request.url?.startsWith("/api/realtime/")) {
      void handleRelayRequest(request, response, io).catch((error: unknown) => {
        logger.error("relay request crashed", { error });
        if (!response.headersSent) response.statusCode = 500;
        response.end();
      });
      return;
    }

    // A rejected request handler must not take the process down with it.
    void handle(request, response).catch((error: unknown) => {
      logger.error("request handler failed", { error, url: request.url });
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      response.end(
        JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side." } }),
      );
    });
  });

  // Realtime shares the HTTP server; see `lib/socket/server.ts`. Behind
  // Passenger (Hodifly) Socket.IO is not attached at all: Apache breaks
  // WebSocket upgrades and every long-poll or half-open upgrade pins one of
  // the account's few concurrent connections, which made unrelated requests
  // queue and fail. The short-poll relay carries realtime there instead, and
  // stale clients asking for /api/socket get an immediate answer.
  const useRelay = relayPreferred();
  const realtime = useRelay ? null : attachRealtimeServer(server);
  io = realtime;
  getRelayHub().setConnectionHandler((client) => acceptRelayClient(io, client));
  if (useRelay) {
    server.on("upgrade", (_request, socket) => {
      socket.end("HTTP/1.1 410 Gone\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    });
  }

  // A stalled socket must not hold a worker open forever.
  server.headersTimeout = 65_000;
  server.requestTimeout = 60_000;
  server.keepAliveTimeout = 61_000;

  const stopWebcupPoller = startWebcupPoller();
  server.on("close", stopWebcupPoller);

  server.listen(port, hostname, () => {
    logger.info("server listening", {
      url: `http://${hostname}:${port}`,
      mode: dev ? "development" : "production",
      realtime: realtime ? "socket.io" : "relay",
    });
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info("shutting down", { signal });

    // Stop accepting work, then let in-flight requests finish.
    realtime?.close();
    server.close();

    try {
      await app.close();
    } catch (error) {
      logger.warn("error while closing the Next.js app", { error });
    }

    // PM2 sends SIGTERM and escalates to SIGKILL after 1.6s by default.
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled promise rejection", { reason });
  });
  process.on("uncaughtException", (error) => {
    logger.error("uncaught exception", { error });
    // An uncaught exception leaves the process in an unknown state; let PM2
    // restart it rather than serving traffic from a corrupted runtime.
    void shutdown("uncaughtException");
  });
}

main().catch((error: unknown) => {
  logger.error("failed to start the server", { error });
  process.exit(1);
});
