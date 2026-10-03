import localFont from "next/font/local";

/**
 * Typefaces of the landing only (all SIL Open Font License, self-hosted, latin
 * subset): Unbounded for titles, Geologica for reading, Martian Mono for the
 * instruments. The rest of the portal keeps its own.
 */
export const unbounded = localFont({ src: "../../app/fonts/unbounded-variable.woff2", weight: "200 900", variable: "--font-tn-display", display: "swap" });
export const geologica = localFont({ src: "../../app/fonts/geologica-variable.woff2", weight: "100 900", variable: "--font-tn-text", display: "swap" });
export const martianMono = localFont({ src: "../../app/fonts/martian-mono-variable.woff2", weight: "100 800", variable: "--font-tn-mono", display: "swap" });
