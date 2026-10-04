import type { MetadataRoute } from "next";

/** Installable app (home-screen icon, standalone window) on phones and desktops. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bubble, la plateforme de Terra Nova",
    short_name: "Bubble",
    description: "La plateforme centrale des habitants de Terra Nova : services de la ville, démarches, alertes, carte, transports et vie de quartier.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0d12",
    theme_color: "#e65100",
    lang: "fr",
    categories: ["government", "social", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Faire une demande", url: "/contact" },
      { name: "Alertes de la ville", url: "/alerts" },
      { name: "Carte de la ville", url: "/city-map" },
      { name: "L'essentiel", url: "/essentials" },
    ],
  };
}
