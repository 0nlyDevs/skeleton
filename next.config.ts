import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Hardening headers applied to every response.
 *
 * The `Content-Security-Policy` is deliberately **not** here: it is generated
 * per request in `src/proxy.ts` so that it can carry a fresh nonce. Setting a
 * second CSP here would intersect with the nonced one and break the app.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    // Same-origin only: calls need camera/microphone, "Ma position" needs
    // geolocation; no third-party frame may ask for any of them.
    value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), display-capture=(self)",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Removes the `X-Powered-By: Next.js` fingerprint.
  poweredByHeader: false,
  compress: true,
  // Never ship source maps to the browser in production.
  productionBrowserSourceMaps: false,

  /*
   * The production build uses webpack (`next build --webpack`): on the
   * contest host the account is capped at 2 GB of RAM, and a cold Turbopack
   * build peaks around 2.4 GB and is killed mid-compile, and the running app
   * shares that budget. Webpack with these options and a heap capped by the
   * build script completes within the budget. The cap is 1 GB: at 768 MB the
   * build ran out of memory while collecting build traces once the 3D landing
   * (three, gsap, lenis) was added.
   * `next dev` keeps Turbopack.
   */
  experimental: {
    webpackMemoryOptimizations: true,
    // Compile in a separate process that exits afterwards, so the main
    // process stays small for page data and build traces.
    webpackBuildWorker: true,
    serverSourceMaps: false,
    // One worker for page data and static generation (each is a process).
    cpus: 1,
  },

  /*
   * Type checking runs in `npm run typecheck` (and the pre-commit gates), not
   * inside `next build`: the checker is a ~1 GB process of its own, and on the
   * host the build shares 2 GB with the running app.
   */
  typescript: { ignoreBuildErrors: true },

  /*
   * Fewer, larger client chunks. The host serves an account at most ~20
   * requests at a time, static files included, and a first page load used to
   * fire ~40 JS chunks at once. Capping the initial and async request counts
   * keeps a page load well under that while staying cacheable (immutable).
   */
  webpack(config, { isServer, dev }) {
    if (!dev) {
      // No persistent cache (serialising it doubles peak memory, and every
      // host build starts clean anyway) and one module at a time.
      config.cache = false;
      config.parallelism = 1;
    }
    if (!isServer && !dev && config.optimization?.splitChunks) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        maxInitialRequests: 4,
        maxAsyncRequests: 4,
        minSize: 120_000,
      };
    }
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  /*
   * Packages that must stay outside the bundler.
   *
   * Prisma 7 generates its client into `src/generated/prisma` — that is
   * application code and *is* bundled — but the MariaDB driver it now depends on
   * opens sockets and does runtime `require`, so it stays external.
   */
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb", "qrcode", "@node-rs/argon2", "sharp"],

  /*
   * The build tracer copies a fraction of what the runtime needs (next
   * 985/8586 with no root shims like headers.js, @swc/helpers 5/438,
   * react-dom 12/43, prisma packages 2/7...), which crashes the custom
   * server at boot with MODULE_NOT_FOUND and would break SSR. Force the
   * full runtime closure into the standalone output. Keys are route globs;
   * values are project-root-relative globs. One route is enough: the
   * standalone folder receives the union of every route's files, and keying
   * on `/*` re-globbed these thousands of files and rewrote a huge trace once
   * per route, which ran the build out of memory as routes were added. The
   * auth catch-all is always dynamic (static routes are skipped here).
   */
  outputFileTracingIncludes: {
    "/api/auth/**": [
      "./node_modules/next/**",
      "./node_modules/react/**",
      "./node_modules/react-dom/**",
      "./node_modules/styled-jsx/**",
      "./node_modules/@swc/helpers/**",
      "./node_modules/client-only/**",
      "./node_modules/@next/env/**",
      "./node_modules/@prisma/adapter-mariadb/**",
      "./node_modules/@prisma/client-runtime-utils/**",
      "./node_modules/@prisma/driver-adapter-utils/**",
      "./node_modules/@prisma/debug/**",
      "./node_modules/mariadb/**",
      "./node_modules/@node-rs/**",
      "./node_modules/iconv-lite/**",
      "./node_modules/safer-buffer/**",
      "./node_modules/denque/**",
      "./node_modules/lru-cache/**",
      "./node_modules/sharp/**",
      "./node_modules/@img/**",
      "./node_modules/@emnapi/**",
      "./node_modules/detect-libc/**",
      "./node_modules/semver/**",
      "./node_modules/color/**",
      "./node_modules/pngjs/**",
      "./node_modules/qrcode/**",
      "./node_modules/dijkstrajs/**",
    ],
  },

  /*
   * Routes used to be French. Notifications and bookmarks created before the
   * rename still hold the old paths, so they keep working.
   */
  async redirects() {
    return [
      { source: "/espace", destination: "/space", permanent: true },
      { source: "/espace/demandes/:reference", destination: "/space/requests/:reference", permanent: true },
      { source: "/annonces", destination: "/announcements", permanent: true },
      { source: "/annonces/:slug", destination: "/announcements/:slug", permanent: true },
      { source: "/agent/demandes", destination: "/agent/requests", permanent: true },
      { source: "/agent/demandes/:reference", destination: "/agent/requests/:reference", permanent: true },
      { source: "/agent/flux", destination: "/agent/feed", permanent: true },
      { source: "/agent/annonces", destination: "/agent/announcements", permanent: true },
      { source: "/agent/annonces/nouvelle", destination: "/agent/announcements/new", permanent: true },
      { source: "/agent/annonces/:slug", destination: "/agent/announcements/:slug", permanent: true },
      { source: "/agent/services/nouveau", destination: "/agent/services/new", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses are per-session; never let a proxy cache them.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        // Uploaded files are served by an authorized route, never indexed.
        source: "/api/files/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
