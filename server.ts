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

import next from "next";

import { env } from "./src/lib/env";
import { logger } from "./src/lib/logger";
import { attachRealtimeServer } from "./src/lib/socket/server";

const dev = !env.isProduction;
const hostname = process.env.HOST ?? "0.0.0.0";
const port = env.PORT;

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  await app.prepare();

  const handle = app.getRequestHandler();

  const server = createServer((request, response) => {
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

  // Realtime shares the HTTP server; see `lib/socket/server.ts`.
  const io = attachRealtimeServer(server);

  // A stalled socket must not hold a worker open forever.
  server.headersTimeout = 65_000;
  server.requestTimeout = 60_000;
  server.keepAliveTimeout = 61_000;

  server.listen(port, hostname, () => {
    logger.info("server listening", {
      url: `http://${hostname}:${port}`,
      mode: dev ? "development" : "production",
      realtime: "socket.io",
    });
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info("shutting down", { signal });

    // Stop accepting work, then let in-flight requests finish.
    io.close();
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
