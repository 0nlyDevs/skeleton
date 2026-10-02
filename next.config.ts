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
   * full runtime closure into the standalone output. Keys are route globs
   * (`/*` = all routes); values are project-root-relative globs.
   */
  outputFileTracingIncludes: {
    "/*": [
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
