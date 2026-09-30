/**
 * PM2 process definition.
 *
 * `server.cjs` is the esbuild bundle of `server.ts` (see `npm run build`), so
 * PM2 starts a plain CommonJS process with no TypeScript loader involved.
 *
 * Nothing here points at a Prisma engine binary on purpose. Prisma 6 needed
 * `PRISMA_QUERY_ENGINE_LIBRARY` on hosts where its platform detection missed the
 * bundled Rust engine (NixOS being the usual case). Prisma 7 is Rust-free — the
 * MariaDB driver adapter does the talking — so those variables are gone and the
 * deployment no longer carries a `/nix/store` path in its process definition.
 *
 * @type {import('pm2').EcosystemConfig}
 */
module.exports = {
  apps: [
    {
      name: "webcup-base",
      script: "./server.cjs",
      // One process on purpose: Socket.IO keeps per-process state, and a single
      // shared port is the only thing cPanel/Passenger will proxy.
      instances: 1,
      exec_mode: "fork",
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
      },
    },
  ],
};
