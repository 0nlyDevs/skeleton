"use client";

import { ChevronDown } from "lucide-react";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";

import { HeroTitle } from "./hero-title";
import { IntroOverlay } from "./intro-overlay";
import { LandingNav } from "./landing-nav";
import { LandingSections } from "./landing-sections";

export interface LandingData {
  /** `openRequests`: the resident's requests still in progress (D11). */
  readonly viewer: { readonly firstName: string; readonly staff: boolean; readonly openRequests: number } | null;
  readonly services: readonly { slug: string; name: string; summary: string; icon: string; category: string; featured: boolean }[];
  readonly news: readonly { slug: string; title: string; summary: string; category: string; publishedAt: string | null }[];
  readonly stats: { readonly services: number; readonly news: number; readonly requests: number };
}

const SEEN_KEY = "tn-intro-seen";

type Mode = "cinematic" | "static";

function pickMode(): Mode {
  if (document.documentElement.hasAttribute("data-eco")) return "static";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  try {
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return "static";
  } catch {
    return "static";
  }
  return "cinematic";
}

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The landing page. Three.js and the scroll libraries load only in the
 * browser and only in cinematic mode; reduced motion, eco mode and devices
 * without WebGL get the final composition directly, with the same content.
 */
export function CinematicLanding({ data }: { readonly data: LandingData }) {
  const t = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const planetRef = useRef<HTMLCanvasElement>(null);
  // Until the intro exists, a skip is remembered and applied as soon as it does.
  const skipRef = useRef<() => void>(() => {
    skipRequested.current = true;
  });
  const skipRequested = useRef(false);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const overlay = overlayRef.current;
    if (!root || !overlay) return;
    const chosen = pickMode();
    setMode(chosen);

    let disposed = false;
    const cleanups: (() => void)[] = [];
    document.documentElement.classList.add("tn-landing-active");
    cleanups.push(() => document.documentElement.classList.remove("tn-landing-active"));

    const run = async () => {
      const [{ StarField }, { createScrollScene }, intro] = await Promise.all([
        import("./star-field"),
        import("./scroll-scene"),
        import("./intro-timeline"),
      ]);
      if (disposed) return;

      if (starsRef.current) {
        const stars = new StarField(starsRef.current);
        stars.start();
        cleanups.push(() => stars.dispose());
      }

      if (chosen === "static") {
        overlay.style.display = "none";
        intro.showFinalState(root, null);
        cleanups.push(createScrollScene(root, null, false));
        return;
      }

      const [{ PlanetStage }, { LoaderStar }] = await Promise.all([import("./planet-stage"), import("./loader-star")]);
      if (disposed || !planetRef.current) return;
      const stage = new PlanetStage(planetRef.current);
      cleanups.push(() => stage.dispose());
      const starCanvas = overlay.querySelector<HTMLCanvasElement>('[data-intro="star-canvas"]');
      const star = starCanvas ? new LoaderStar(starCanvas) : null;
      star?.start();
      cleanups.push(() => star?.dispose());

      // The counter shows real download progress, never faster than a short minimum.
      const quick = readSeen();
      const counter = overlay.querySelector<HTMLElement>('[data-intro="counter"]');
      const shown = { value: 0 };
      let target = 0;
      const minimum = gsap.to({}, { duration: quick ? 0.6 : 2.4 });
      skipRef.current = () => {
        skipRequested.current = true;
        minimum.progress(1);
        target = 100;
        shown.value = 100;
      };
      if (skipRequested.current) skipRef.current();
      const follow = gsap.ticker.add(() => {
        const cap = minimum.progress() * 100;
        const goal = skipRequested.current ? 100 : Math.min(target, cap);
        shown.value += (goal - shown.value) * 0.12;
        if (counter) counter.textContent = String(Math.min(100, Math.round(shown.value)));
      });
      cleanups.push(() => gsap.ticker.remove(follow));

      window.scrollTo(0, 0);
      try {
        await stage.load((value) => {
          target = value * 100;
        });
      } catch {
        // Models unavailable: show the composition without the planets.
        gsap.ticker.remove(follow);
        overlay.style.display = "none";
        intro.showFinalState(root, null);
        cleanups.push(createScrollScene(root, null, true));
        return;
      }
      if (disposed) return;
      stage.start();
      await new Promise<void>((resolve) => {
        const wait = () => (skipRequested.current || (shown.value > 99.4 && minimum.progress() === 1) ? resolve() : requestAnimationFrame(wait));
        wait();
      });
      gsap.ticker.remove(follow);
      if (counter) counter.textContent = "100";
      if (disposed) return;

      const timeline = intro.buildIntro(root, overlay, stage, star);
      timeline.timeScale(quick ? 1.6 : 0.72);
      let finished = false;
      const finish = () => {
        if (finished || disposed) return;
        finished = true;
        star?.dispose();
        document.documentElement.classList.remove("tn-intro-lock");
        try {
          window.sessionStorage.setItem(SEEN_KEY, "1");
        } catch {
          // Private mode: the intro simply plays in full next time.
        }
        cleanups.push(createScrollScene(root, stage, true));
      };
      timeline.eventCallback("onComplete", finish);
      skipRef.current = () => {
        timeline.progress(1);
        finish();
      };
      if (skipRequested.current) skipRef.current();
      cleanups.push(() => timeline.kill());
    };

    document.documentElement.classList.add("tn-intro-lock");
    cleanups.push(() => document.documentElement.classList.remove("tn-intro-lock"));
    void run();

    return () => {
      disposed = true;
      for (const cleanup of cleanups.reverse()) cleanup();
    };
  }, []);

  return (
    <div ref={rootRef} className="tn-landing relative min-h-dvh overflow-x-clip bg-[#02040b] text-white" data-mode={mode ?? "pending"}>
      <div aria-hidden className="tn-nebula pointer-events-none fixed inset-0 z-0" />
      <canvas ref={starsRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 size-full" />
      <canvas ref={planetRef} aria-hidden className="pointer-events-none fixed inset-0 z-[2] size-full" />
      <div aria-hidden className="tn-static-planet pointer-events-none fixed inset-x-0 bottom-0 z-[2]" />

      <LandingNav viewer={data.viewer} />

      <main id="content">
        <section data-scene="hero" className="relative h-[100svh]">
          {/* The title's bottom sits just below the planet's horizon (HORIZON_* in planet-stage):
              the letters rise out from behind the globe and stay partly hidden by it. */}
          <div data-hero="title-wrap" className="absolute inset-x-0 bottom-[46svh] z-[1] flex flex-col items-center px-2 text-center portrait:bottom-[38svh]">
            <p
              data-hero="kicker"
              className="absolute bottom-[calc(min(19vw,36svh)*0.52+1.6rem)] text-[0.6875rem] uppercase tracking-[0.45em] text-white/60 opacity-0 sm:text-[0.75rem]"
            >
              {t("tn.home.badge")}
            </p>
            <HeroTitle />
          </div>
          {/* Scrim over the planet so the text and buttons on it stay readable. */}
          <div data-hero-ui data-hero="scrim" aria-hidden className="tn-hero-scrim pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[64svh] opacity-0" />
          <div data-hero="hero-ui" className="absolute inset-x-0 bottom-[12svh] z-[3] flex flex-col items-center gap-5 px-4 text-center">
            <p data-hero-ui className="max-w-[44ch] text-[0.9062rem] font-medium leading-relaxed text-white opacity-0 [text-shadow:0_1px_14px_rgb(0_0_0/0.9)] sm:text-[1rem]">
              {data.viewer ? t("tn.home.hello", { name: data.viewer.firstName }) + " — " : ""}
              {t("tn.home.subtitle")}
            </p>
            {data.viewer && data.viewer.openRequests > 0 ? (
              <Link data-hero-ui href="/space" className="text-[0.875rem] font-medium text-cyan-200 underline-offset-4 opacity-0 [text-shadow:0_1px_14px_rgb(0_0_0/0.9)] hover:underline">
                {t("tn.home.open_requests", { count: data.viewer.openRequests })}
              </Link>
            ) : null}
            <div data-hero-ui className="flex flex-wrap justify-center gap-3 opacity-0">
              {data.viewer ? (
                <>
                  <Link href="/contact" className="tn-cta-primary rounded-full px-6 py-3 text-[0.9062rem] font-semibold">
                    {t("tn.home.cta_request")}
                  </Link>
                  <Link href="/space" className="tn-cta-ghost rounded-full px-6 py-3 text-[0.9062rem]">
                    {t("tn.home.cta_space")}
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register" className="tn-cta-primary rounded-full px-6 py-3 text-[0.9062rem] font-semibold">
                    {t("tn.home.cta_join")}
                  </Link>
                  <Link href="/services" className="tn-cta-ghost rounded-full px-6 py-3 text-[0.9062rem]">
                    {t("tn.home.cta_services")}
                  </Link>
                </>
              )}
            </div>
          </div>
          <span data-hero-ui className="absolute bottom-[2.5svh] left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-0.5 text-[0.625rem] uppercase tracking-[0.4em] text-white/50 opacity-0">
            {t("tn.landing.scroll")}
            <ChevronDown className="tn-bounce size-4" aria-hidden />
          </span>
        </section>

        <LandingSections data={data} />
      </main>

      <IntroOverlay ref={overlayRef} onSkip={() => skipRef.current()} />
    </div>
  );
}
