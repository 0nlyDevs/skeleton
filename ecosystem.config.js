/** @type {import('pm2').EcosystemConfig} */
module.exports = {
  apps: [
    {
      name: "webcup-base",
      script: "./server.cjs",
      instances: 1,
      exec_mode: "fork",
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
        PRISMA_QUERY_ENGINE_LIBRARY:
          "/nix/store/v11kl5cjdb2lhkb6r7cx02pfp4wqs78q-prisma-engines_6-6.19.3/lib/libquery_engine.node",
      },
      env_development: {
        NODE_ENV: "development",
        PRISMA_QUERY_ENGINE_LIBRARY:
          "/nix/store/v11kl5cjdb2lhkb6r7cx02pfp4wqs78q-prisma-engines_6-6.19.3/lib/libquery_engine.node",
      },
    },
  ],
};
