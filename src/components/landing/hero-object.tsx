"use client";

import dynamic from "next/dynamic";

/**
 * Loading boundary for the 3D hero.
 *
 * `next/dynamic` with `ssr: false` keeps three.js (~150 kB gzipped) out of the
 * landing page bundle entirely: it is fetched only when this component mounts in
 * the browser, after the page itself has painted. `ssr: false` is required
 * because WebGL does not exist on the server.
 *
 * While it loads — and forever on a reduced-motion or no-WebGL device — the
 * fallback in `hero-object-3d.tsx` (a soft accent glow) stands in, so the hero
 * is never an empty rectangle. The 3D is an enhancement, never a dependency.
 */
const HeroObject3D = dynamic(
  () => import("./hero-object-3d").then((mod) => mod.HeroObject3D),
  {
    ssr: false,
    loading: () => (
      <div className="relative aspect-square w-full max-w-[520px]" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_65%)] blur-2xl" />
      </div>
    ),
  },
);

export function HeroObject() {
  return <HeroObject3D />;
}
