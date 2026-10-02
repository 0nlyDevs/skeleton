/** Visual presets for user pages. Each one is a full, accessible palette. */
export const PAGE_THEME_STYLES = {
  aurora: {
    hero: "bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 text-white",
    body: "bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100",
    accent: "text-violet-600 dark:text-violet-300",
    button: "bg-violet-600 text-white hover:bg-violet-700",
    card: "bg-violet-50 dark:bg-violet-950/40",
    swatch: "from-violet-600 via-fuchsia-500 to-cyan-400",
  },
  sunset: {
    hero: "bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600 text-white",
    body: "bg-orange-50/40 text-stone-900 dark:bg-stone-950 dark:text-stone-100",
    accent: "text-rose-600 dark:text-rose-300",
    button: "bg-rose-600 text-white hover:bg-rose-700",
    card: "bg-rose-50 dark:bg-rose-950/40",
    swatch: "from-orange-500 via-rose-500 to-purple-600",
  },
  ocean: {
    hero: "bg-gradient-to-br from-sky-600 via-cyan-500 to-teal-400 text-white",
    body: "bg-sky-50/40 text-slate-900 dark:bg-slate-950 dark:text-slate-100",
    accent: "text-sky-700 dark:text-sky-300",
    button: "bg-sky-700 text-white hover:bg-sky-800",
    card: "bg-sky-50 dark:bg-sky-950/40",
    swatch: "from-sky-600 via-cyan-500 to-teal-400",
  },
  forest: {
    hero: "bg-gradient-to-br from-emerald-700 via-green-600 to-lime-500 text-white",
    body: "bg-emerald-50/40 text-stone-900 dark:bg-stone-950 dark:text-stone-100",
    accent: "text-emerald-700 dark:text-emerald-300",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
    card: "bg-emerald-50 dark:bg-emerald-950/40",
    swatch: "from-emerald-700 via-green-600 to-lime-500",
  },
  night: {
    hero: "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-amber-100",
    body: "bg-slate-950 text-slate-100",
    accent: "text-amber-300",
    button: "bg-amber-400 text-slate-950 hover:bg-amber-300",
    card: "bg-slate-900",
    swatch: "from-slate-950 via-indigo-950 to-amber-500",
  },
  paper: {
    hero: "bg-stone-100 text-stone-900 dark:bg-stone-900 dark:text-stone-100",
    body: "bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100",
    accent: "text-stone-700 dark:text-stone-300",
    button: "bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900",
    card: "bg-white dark:bg-stone-900",
    swatch: "from-stone-200 via-stone-100 to-stone-300",
  },
  mono: {
    hero: "bg-black text-white",
    body: "bg-white text-black dark:bg-black dark:text-white",
    accent: "text-black dark:text-white underline decoration-2 underline-offset-4",
    button: "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black",
    card: "bg-neutral-100 dark:bg-neutral-900",
    swatch: "from-black via-neutral-600 to-white",
  },
} as const;

export const PAGE_FONT_CLASS = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
} as const;

export type PageThemeName = keyof typeof PAGE_THEME_STYLES;

export function themeOf(name: string) {
  return PAGE_THEME_STYLES[(name in PAGE_THEME_STYLES ? name : "aurora") as PageThemeName];
}
