import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/** Public pages may be indexed; private areas and the API may not. */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: ["/", "/accessibility", "/glossary", "/services", "/announcements", "/feed", "/p/", "/pages", "/groups", "/profile/"], disallow: ["/api/", "/agent", "/space", "/contact", "/admin", "/settings", "/messages", "/notifications", "/saved"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
