"use client";

import { ChevronDown } from "lucide-react";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { CityZoneId, ZoneStatusId } from "@/modules/alerts/city-zones";

import { ArrivalGate, type ArrivalPass } from "./arrival-gate";
import { LandingNav } from "./landing-nav";
import { LandingSections } from "./landing-sections";
import type { LandingStage } from "./stage/landing-stage";

export interface LandingData {
  /** `openRequests`: the resident's requests still in progress (D11). */
  readonly viewer: { readonly firstName: string; readonly staff: boolean; readonly openRequests: number } | null;
  readonly services: readonly { slug: string; name: string; summary: string; icon: string; category: string; featured: boolean }[];
  readonly news: readonly { slug: string; title: string; summary: string; category: string; publishedAt: string | null }[];
  readonly stats: { readonly services: number; readonly news: number; readonly requests: number };
  /** The state of each district, from the active alerts. */
  readonly zones: readonly { readonly zone: CityZoneId; readonly status: ZoneStatusId; readonly residents: number }[];
}

/** Set once the visitor has landed: in the same tab, the next visit opens on the island directly. */
const SEEN_KEY = "tn-arrived";

/** The stops of the flight, in the order of the sections and of the camera rail. */
const STOPS: readonly (CityZoneId | null)[] = [null, "SKYPORT_ISLES", "NOVA_PRIME", "SUNKEN_DELTA", "CRYSTAL_REACH", "VERDANT_BASIN", "FROSTPEAK", "EMBER_WASTES", "OBSIDIAN_COAST"];

type Mode = "cinematic" | "static";
type Phase = "loading" | "gate" | "descent" | "city";

function pickMode(): Mode {
  if (document.documentElement.hasAttribute("data-eco")) return "static";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  try {
    if (!document.createElement("canvas").getContext("webgl2")) return "static";
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
 * The landing page: an arrival from orbit with the sign-in at the gate, the
 * descent through the clouds, then a flight over the island where each
 * district presents one part of the portal. Three.js and the scroll libraries
 * load only in the browser and only in cinematic mode; reduced motion, eco
 * mode and devices without WebGL get the same content on a still backdrop.
 */
export function CinematicLanding({ data }: { readonly data: LandingData }) {
  const t = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const descendRef = useRef<(pass: ArrivalPass) => void>(() => {});
  const skipRef = useRef<() => void>(() => {});
  const viewerRef = useRef(data.viewer);
  const [mode, setMode] = useState<Mode | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [pass, setPass] = useState<ArrivalPass | null>(null);

  useEffect(() => {
    viewerRef.current = data.viewer;
  }, [data.viewer]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const loader = loaderRef.current;
    if (!root || !canvas || !loader) return;
    const chosen = pickMode();
    setMode(chosen);

    let disposed = false;
    const cleanups: (() => void)[] = [];
    const html = document.documentElement;
    html.classList.add("tn-landing-active", "tn-intro-lock");
    cleanups.push(() => html.classList.remove("tn-landing-active", "tn-intro-lock"));

    /** The page under the arrival screen becomes usable: scroll, sections, instruments. */
    const openCity = async (stage: LandingStage | null) => {
      const { createTour } = await import("./tour-timeline");
      if (disposed) return;
      html.classList.remove("tn-intro-lock");
      setPhase("city");
      // The sections must be laid out (visible) before their scroll positions are measured.
      requestAnimationFrame(() => {
        if (disposed) return;
        cleanups.push(createTour(root, stage, stage !== null));
        gsap.fromTo(root.querySelectorAll("[data-hero-item]"), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: "power3.out" });
        gsap.fromTo(root.querySelectorAll("[data-chapter='arrival'] .tn-line > span"), { yPercent: 110 }, { yPercent: 0, duration: 1.2, stagger: 0.1, ease: "power3.out" });
        gsap.fromTo(root.querySelectorAll("[data-hero='nav'], .tn-hud"), { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 0.5, ease: "power2.out" });
      });
    };

    const goStatic = async () => {
      setMode("static");
      loader.style.display = "none";
      const { StarField } = await import("./star-field");
      if (disposed) return;
      if (starsRef.current) {
        const stars = new StarField(starsRef.current);
        stars.start();
        cleanups.push(() => stars.dispose());
      }
      await openCity(null);
    };

    const run = async () => {
      if (chosen === "static") return goStatic();
      window.scrollTo(0, 0);

      const { LandingStage } = await import("./stage/landing-stage");
      if (disposed) return;
      let stage: LandingStage;
      try {
        stage = new LandingStage(canvas);
      } catch {
        return goStatic();
      }
      let alive = true;
      const release = () => {
        if (alive) stage.dispose();
        alive = false;
      };
      cleanups.push(release);

      // The loader counts real progress: the planet's download, then the island being built.
      const count = loader.querySelector<HTMLElement>("[data-loader='count']");
      const bar = loader.querySelector<HTMLElement>("[data-loader='bar']");
      const shown = { value: 0 };
      const show = (value: number) =>
        gsap.to(shown, {
          value,
          duration: 0.5,
          ease: "power1.out",
          overwrite: true,
          onUpdate: () => {
            if (count) count.textContent = String(Math.round(shown.value));
            if (bar) bar.style.transform = `scaleX(${shown.value / 100})`;
          },
        });
      try {
        await Promise.race([
          stage.load((value) => show(value * 100)),
          new Promise((_, reject) => setTimeout(() => reject(new Error("stage timeout")), 30000)),
        ]);
      } catch {
        // No planet, or a graphics chip that cannot build the scene: the still version.
        release();
        return goStatic();
      }
      if (disposed) return;
      show(100);
      stage.start();
      const state = stage.state;

      /** Lands on the island; `quick` skips the flight down (a visitor who has already seen it). */
      let timeline: gsap.core.Timeline | null = null;
      const land = (quick: boolean) => {
        if (timeline) return;
        setPhase("descent");
        const altitude = root.querySelector<HTMLElement>("[data-entry='altitude']");
        const arrive = () => {
          try {
            window.sessionStorage.setItem(SEEN_KEY, "1");
          } catch {
            // Private mode: the arrival simply plays again next time.
          }
          stage.onBeacon = null;
          void openCity(stage);
        };
        timeline = gsap.timeline();
        cleanups.push(() => timeline?.kill());
        if (quick) {
          state.phase = "world";
          state.flash = 1;
          state.entry = 0.4;
          timeline.to(state, { flash: 0, duration: 1.5, ease: "power2.out" }, 0).to(state, { entry: 0, duration: 2.8, ease: "power3.out" }, 0).add(arrive, 0.25);
          return;
        }
        const fall = { km: 374 };
        timeline
          .to("[data-gate='root']", { autoAlpha: 0, duration: 0.7, ease: "power2.in" }, 1.5)
          .to("[data-entry='root']", { autoAlpha: 1, duration: 0.5 }, 1.9)
          .to(state, { dive: 1, duration: 2.8, ease: "power2.in" }, 1.1)
          .to(state, { shake: 1, duration: 2.2, ease: "power2.in" }, 1.5)
          .to(state, { flash: 1, duration: 0.8, ease: "power2.in" }, 3.1)
          .add(() => {
            state.phase = "world";
            state.entry = 1;
            state.dive = 0;
          }, 3.95)
          .to(state, { flash: 0, duration: 1.8, ease: "power2.out" }, 4.1)
          .to(state, { entry: 0, duration: 4.8, ease: "power3.out" }, 4)
          .to(state, { shake: 0, duration: 2.8, ease: "power2.out" }, 4.1)
          .to(
            fall,
            {
              km: 0.4,
              duration: 5.4,
              ease: "power2.out",
              onUpdate: () => {
                if (altitude) altitude.textContent = fall.km > 10 ? fall.km.toFixed(0) : fall.km.toFixed(1);
              },
            },
            1.4,
          )
          .to("[data-entry='root']", { autoAlpha: 0, duration: 0.8 }, 6)
          .add(arrive, 6.2);
      };
      descendRef.current = (granted) => {
        setPass(granted);
        land(false);
      };
      skipRef.current = () => timeline?.progress(1);

      await gsap.to(loader, { autoAlpha: 0, duration: 0.8, delay: 0.35, ease: "power2.inOut" });
      loader.style.display = "none";
      if (disposed) return;

      if (readSeen()) {
        land(true);
        return;
      }

      // In orbit: the ship drifts closer while the visitor signs in.
      setPhase("gate");
      const approach = gsap.to(state, { approach: 1, duration: 70, ease: "power1.out" });
      cleanups.push(() => approach.kill());
      const readout = { altitude: null as HTMLElement | null, speed: null as HTMLElement | null, beacon: null as HTMLElement | null };
      const instruments = gsap.ticker.add(() => {
        readout.altitude ??= root.querySelector("[data-gate='altitude']");
        readout.speed ??= root.querySelector("[data-gate='speed']");
        if (readout.altitude) readout.altitude.textContent = (412 - state.approach * 38 - state.dive * 370).toFixed(0);
        if (readout.speed) readout.speed.textContent = (7.61 + Math.sin(performance.now() / 900) * 0.02 + state.dive * 3.2).toFixed(2);
      });
      cleanups.push(() => gsap.ticker.remove(instruments));
      stage.onBeacon = (x, y, visible) => {
        readout.beacon ??= root.querySelector("[data-gate='beacon']");
        if (!readout.beacon) return;
        readout.beacon.style.opacity = visible ? "1" : "0";
        readout.beacon.style.transform = `translate3d(${x * window.innerWidth}px, ${y * window.innerHeight}px, 0)`;
      };
      // A resident who is already signed in is recognised and goes straight down.
      const viewer = viewerRef.current;
      if (viewer) {
        const welcome = gsap.delayedCall(1.2, () => descendRef.current({ name: viewer.firstName, visitor: false }));
        cleanups.push(() => welcome.kill());
      }
    };

    void run();

    return () => {
      disposed = true;
      for (const cleanup of cleanups.reverse()) cleanup();
    };
  }, []);

  const gateOpen = mode === "cinematic" && (phase === "gate" || phase === "descent");

  return (
    <div ref={rootRef} className="tn-landing relative min-h-dvh overflow-x-clip bg-[#02040b] text-white" data-mode={mode ?? "pending"} data-phase={phase}>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 size-full" />
      <canvas ref={starsRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 size-full" />
      <div aria-hidden className="tn-static-planet pointer-events-none fixed inset-x-0 bottom-0 z-[2]" />

      <LandingNav viewer={data.viewer} />

      <main id="content" inert={mode !== "static" && phase !== "city"}>
        <section data-chapter="arrival" className="relative flex h-[100svh] flex-col justify-end">
          <div aria-hidden className="tn-hero-shade pointer-events-none absolute inset-x-0 bottom-0 h-[70svh]" />
          <div data-hero="block" className="relative z-[3] flex flex-col items-start gap-5 px-5 pb-[11svh] sm:px-[max(2.5rem,6vw)]">
            <p data-hero-item className="flex items-center gap-3 text-[0.6875rem] uppercase tracking-[0.4em] text-white/75 sm:text-[0.75rem]">
              <span aria-hidden className="h-px w-8 bg-[var(--brand-400)]" />
              {t("tn.home.badge")}
            </p>
            <h1 className="tn-hero-title font-display text-[clamp(3.4rem,13vw,11.5rem)] font-bold leading-[0.86] tracking-tight">
              <span className="tn-line">
                <span>TERRA</span>
              </span>{" "}
              <span className="tn-line">
                <span>NOVA</span>
              </span>
            </h1>
            <p data-hero-item className="max-w-[46ch] text-[0.9375rem] font-medium leading-relaxed text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.9)] sm:text-[1.0625rem]">
              {data.viewer ? t("tn.home.hello", { name: data.viewer.firstName }) + " — " : ""}
              {t("tn.home.subtitle")}
            </p>
            {data.viewer && data.viewer.openRequests > 0 ? (
              <Link data-hero-item href="/space" className="text-[0.875rem] font-medium text-[var(--brand-400)] underline-offset-4 [text-shadow:0_1px_14px_rgb(0_0_0/0.9)] hover:underline">
                {t("tn.home.open_requests", { count: data.viewer.openRequests })}
              </Link>
            ) : null}
            <div data-hero-item className="flex flex-wrap gap-3">
              {data.viewer ? (
                <>
                  <Link href="/contact" className="tn-cta-brand rounded-full px-6 py-3 text-[0.9062rem] font-semibold">
                    {t("tn.home.cta_request")}
                  </Link>
                  <Link href="/space" className="tn-cta-ghost rounded-full px-6 py-3 text-[0.9062rem]">
                    {t("tn.home.cta_space")}
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register" className="tn-cta-brand rounded-full px-6 py-3 text-[0.9062rem] font-semibold">
                    {t("tn.home.cta_join")}
                  </Link>
                  <Link href="/services" className="tn-cta-ghost rounded-full px-6 py-3 text-[0.9062rem]">
                    {t("tn.home.cta_services")}
                  </Link>
                </>
              )}
            </div>
          </div>
          <span data-hero-item className="absolute bottom-[2.5svh] left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-0.5 text-[0.625rem] uppercase tracking-[0.35em] text-white/65">
            {t("tn.tour.scroll")}
            <ChevronDown className="tn-bounce size-4" aria-hidden />
          </span>
        </section>

        <LandingSections data={data} />
      </main>

      {/* Instruments of the flight: the hour on the island, the stops, the line to a landmark. */}
      <div className="tn-hud">
        <p className="pointer-events-none fixed bottom-5 left-5 z-[4] hidden flex-col gap-1 text-[0.625rem] uppercase tracking-[0.3em] text-white/65 [text-shadow:0_1px_10px_rgb(0_0_0/0.9)] sm:left-8 lg:flex">
          {t("tn.tour.clock")}
          <span data-hud="clock" className="font-mono text-[1.0625rem] tracking-[0.12em] text-white tabular-nums">
            06:10
          </span>
        </p>
        <nav aria-label={t("tn.tour.progress")} className="fixed right-4 top-1/2 z-[5] hidden -translate-y-1/2 lg:block">
          <ol className="flex flex-col items-end">
            {STOPS.map((zone) => (
              <li key={zone ?? "arrival"} className="w-full">
                <button type="button" data-hud="mark" className="tn-mark">
                  <span>{zone ? t(`alerts.zone.${zone}`) : t("tn.tour.stop.arrival")}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <svg aria-hidden className="pointer-events-none fixed inset-0 z-[4] hidden size-full lg:block">
          <line data-hud="line" stroke="var(--brand-400)" strokeWidth="1" strokeDasharray="2 5" opacity="0" />
        </svg>
        <p data-hud="tag" aria-hidden className="tn-tag hidden lg:block" />
      </div>

      {gateOpen ? (
        <>
          <ArrivalGate
            pass={pass}
            onGranted={(name) => descendRef.current({ name, visitor: false })}
            onVisitor={() => descendRef.current({ name: null, visitor: true })}
            onSkip={() => skipRef.current()}
          />
          <p data-entry="root" aria-hidden className="pointer-events-none invisible fixed inset-x-0 bottom-[14svh] z-30 flex flex-col items-center gap-2 text-center opacity-0">
            <span className="text-[0.6875rem] uppercase tracking-[0.5em] text-white/80 [text-shadow:0_1px_12px_rgb(0_0_0/0.8)]">{t("tn.arrival.entry")}</span>
            <span className="font-mono text-[2.5rem] font-semibold tabular-nums text-white [text-shadow:0_2px_24px_rgb(0_0_0/0.7)]">
              <span data-entry="altitude">374</span> km
            </span>
          </p>
        </>
      ) : null}

      <div ref={loaderRef} role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#02040b]">
        <p className="font-display text-[1.375rem] font-bold tracking-[0.3em]">TERRA NOVA</p>
        <div className="h-px w-[min(60vw,280px)] overflow-hidden bg-white/15">
          <div data-loader="bar" className="h-full origin-left scale-x-0 bg-[var(--brand-400)]" />
        </div>
        <p className="flex items-baseline gap-3 text-[0.6875rem] uppercase tracking-[0.32em] text-white/60">
          {t("tn.arrival.loading")}
          <span className="font-mono text-white tabular-nums">
            <span data-loader="count">0</span>%
          </span>
        </p>
      </div>
    </div>
  );
}
