import localFont from "next/font/local";

/** Interface typeface (Fontshare, ITF Free Font License), self-hosted. */
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

/** Display serif for the TERRA NOVA wordmark (Fontshare, ITF Free Font License). */
export const boska = localFont({
  src: [
    { path: "./fonts/boska-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/boska-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/boska-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-boska",
  display: "swap",
});
