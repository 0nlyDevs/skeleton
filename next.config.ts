import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Hardening headers applied to every response.
 *
 * The `Content-Security-Policy` is deliberately **not** here: it is generated
 * per request in `middleware.ts` so that it can carry a fresh nonce. Setting a
 * second CSP here would intersect with the nonced one and break the app.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
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

  // Native / engine-bearing packages must stay outside the bundler.
  serverExternalPackages: ["@prisma/client", "qrcode", "@node-rs/argon2"],

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
