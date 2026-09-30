import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test configuration.
 *
 * The aliases mirror `tsconfig.json`, so a test imports the application exactly
 * as the application imports itself — `@/lib/...` — and a moved file cannot pass
 * its tests only because a relative path happened to be right.
 *
 * `environment: "node"` is deliberate: the tests here cover server-side rules
 * (authorization, rate-limit keys, validation). Anything needing a DOM would be
 * better covered by an end-to-end pass than by a jsdom approximation.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@emails": path.resolve(root, "emails"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
    /*
     * `lib/env.ts` validates the whole environment on first access, and the
     * authorization helpers live in a module that transitively reaches it. The
     * values below are never used to connect: constructing a Prisma client with
     * the driver adapter opens no socket, and the database URL deliberately
     * points nowhere so a test that does reach for the network fails loudly
     * instead of touching a developer's database.
     */
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "mysql://webcup:webcup@127.0.0.1:1/webcup_test",
      BETTER_AUTH_SECRET: "test-only-secret-not-used-for-signing",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },

});
