/**
 * Prisma CLI configuration (Prisma 7).
 *
 * v7 stopped reading `.env` by itself and moved the connection URL out of the
 * schema, so both live here: `dotenv/config` loads the environment and
 * `env("DATABASE_URL")` is type-checked against it.
 *
 * The runtime does *not* read this file — it builds a driver adapter with the
 * same URL in `src/lib/db/prisma.ts`. Two entry points, one source of truth.
 */

import "dotenv/config";

import { existsSync, readdirSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

/**
 * Point the CLI at a Nix-provided schema engine when there is one.
 *
 * Prisma publishes no `linux-nixos` prebuilt binary, so on NixOS every CLI
 * command fails with a 404 while fetching the engine — even though nixpkgs ships
 * the exact matching build. Detecting it here means `npm run db:generate` and
 * `npm run db:deploy` work on the tooling this project is developed on, instead
 * of requiring a hand-exported environment variable that is easy to forget.
 *
 * An explicit `PRISMA_SCHEMA_ENGINE_BINARY` always wins, and a failed lookup is
 * silent: on any other platform Prisma's own resolution is correct.
 */
function applyNixSchemaEngine(): void {
  if (process.env.PRISMA_SCHEMA_ENGINE_BINARY || process.platform !== "linux") return;

  try {
    const store = "/nix/store";
    if (!existsSync(store)) return;

    // The store holds one directory per version; pick the newest that ships the
    // engine and matches the CLI's major version (7.x here).
    const candidate = readdirSync(store)
      .filter((entry) => /-prisma-engines_7-7\./.test(entry))
      .sort()
      .map((entry) => `${store}/${entry}/bin/schema-engine`)
      .find((path) => existsSync(path));

    if (candidate) {
      process.env.PRISMA_SCHEMA_ENGINE_BINARY = candidate;
      process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING ??= "1";
    }
  } catch {
    // Diagnostics here would be noise before every CLI command.
  }
}

applyNixSchemaEngine();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // v7 no longer seeds automatically after `migrate dev`/`reset`, so the
    // command is declared here and run explicitly with `prisma db seed`.
    seed: "tsx --env-file-if-exists=.env prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
