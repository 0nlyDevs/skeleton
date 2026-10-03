"use client";

import { forwardRef } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";

/**
 * The preloader, kept quiet: a small star, a thin counter, a hairline.
 * Two panels share one diagonal seam, from the bottom-left corner to the
 * top-right one; the star sits on that seam, so when it shoots along it the
 * panels part like a curtain slashed open. Parts are found by `data-intro`.
 */
export const IntroOverlay = forwardRef<HTMLDivElement, { readonly onSkip: () => void }>(function IntroOverlay({ onSkip }, ref) {
  const t = useTranslation();

  return (
    <div ref={ref} className="tn-intro fixed inset-0 z-[60] bg-[#03050c]">
      <div data-intro="panel-a" className="tn-intro-panel absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]" />
      <div data-intro="panel-b" className="tn-intro-panel absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />

      {/* Hairline along the seam; its length and angle are set from the viewport. */}
      <div data-intro="slash" aria-hidden className="tn-slash absolute bottom-0 left-0 h-px origin-left" />

      <div data-intro="star" aria-hidden className="absolute left-[8vw] top-[92vh] size-14 sm:size-16">
        <canvas data-intro="star-canvas" className="size-full" />
      </div>

      <div data-intro="label" aria-hidden className="absolute bottom-[calc(8vh-0.35rem)] left-[calc(8vw+2.75rem)] flex items-baseline gap-3 text-white">
        <span className="text-[22px] font-light leading-none tabular-nums tracking-tight">
          <span data-intro="counter">0</span>
          <span className="text-white/40">%</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.32em] text-white/40">{t("tn.landing.loading")}</span>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="absolute right-5 top-5 px-2 py-1 text-[11px] uppercase tracking-[0.28em] text-white/40 transition-colors hover:text-white"
      >
        {t("tn.landing.skip")}
      </button>
    </div>
  );
});
