import type { MetadataRoute } from "next";

/** Installable app (home-screen icon, standalone window) on phones and desktops. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Terra Nova",
    short_name: "Terra Nova",
    description: "Portail des habitants de Terra Nova : services, annonces, démarches.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#c2552a",
    lang: "fr",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
