import localFont from "next/font/local";

/**
 * Title face of the landing: Cabinet Grotesk (Fontshare, ITF Free Font
 * License), self-hosted as one variable file. Text stays in General Sans,
 * like the rest of the portal.
 */
export const cabinetGrotesk = localFont({ src: "../../app/fonts/cabinet-grotesk-variable.woff2", weight: "100 900", variable: "--font-tn-display", display: "swap" });
