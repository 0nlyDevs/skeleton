import type { MetadataRoute } from "next";

import { brand } from "@/lib/brand";

/** Installable app (home-screen icon, standalone window) on phones and desktops. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: "Réseau social : publications, groupes, messages, pages.",
    start_url: "/feed",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#7c5cff",
    lang: "fr",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
