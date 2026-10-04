import localFont from "next/font/local";

/**
 * Interface typeface (Fontshare, ITF Free Font License), self-hosted. Only
 * the weights the interface uses are shipped (300 is the landing's light text).
 */
export const generalSans = localFont({
  src: [
    { path: "./fonts/general-sans-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/general-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/general-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/general-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/general-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
});

/**
 * Display typeface for titles and the city's name (Fontshare, ITF Free Font
 * License): one variable file, one voice. Text stays in General Sans.
 */
export const cabinetGrotesk = localFont({
  src: "./fonts/cabinet-grotesk-variable.woff2",
  weight: "100 900",
  variable: "--font-cabinet",
  display: "swap",
});
