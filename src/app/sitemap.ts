import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/** The public pages of the platform, for search engines (private areas are excluded in `robots.ts`). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const pages = ["", "/start", "/services", "/announcements", "/alerts", "/city-map", "/transports", "/participate", "/partners", "/essentials", "/reports", "/glossary", "/accessibility", "/eco", "/login", "/register"];
  return pages.map((path) => ({ url: `${base}${path}`, changeFrequency: path === "" || path === "/alerts" || path === "/announcements" ? "daily" : "weekly", priority: path === "" ? 1 : 0.6 }));
}
