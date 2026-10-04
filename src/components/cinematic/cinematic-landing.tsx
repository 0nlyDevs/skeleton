"use client";

import { ChevronDown } from "lucide-react";
import gsap from "gsap";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import type { CityZoneId, ZoneStatusId } from "@/modules/alerts/city-zones";

import { cabinetGrotesk } from "./landing-fonts";
import { LandingNav } from "./landing-nav";
import { LandingSections } from "./landing-sections";
import type { SoundCue, SoundEngine } from "./sound";
import type { LandingStage } from "./stage/landing-stage";
import type { Tour } from "./tour-timeline";
import "./landing.css";

export interface LandingData {
  /** `openRequests`: the resident's requests still in progress (D11). */
  readonly viewer: { readonly firstName: string; readonly staff: boolean; readonly openRequests: number } | null;
  readonly services: readonly { slug: string; name: string; summary: string; icon: string; category: string; featured: boolean }[];
  readonly news: readonly { slug: string; title: string; summary: string; category: string; publishedAt: string | null }[];
  readonly stats: { readonly services: number; readonly news: number; readonly requests: number };
  /** The state of each district, from the active alerts. */
  readonly zones: readonly { readonly zone: CityZoneId; readonly status: ZoneStatusId; readonly residents: number }[];
}

type RegistryView = "signin" | "register";

/** What `/login` and `/register` ask of the landing: open the registry on arrival. */
export interface RegistryRequest {
  readonly view: RegistryView;
  /** Where to go once signed in; already validated on the server. */
  readonly redirectTo: string;
  readonly errorKey: MessageKey | null;
}

/** Set once the visitor has landed: in the same tab, the next visit opens on the island directly. */
const SEEN_KEY = "tn-arrived";

/** The stops of the flight, in the order of the sections and of the camera rail. */
const STOPS: readonly (CityZoneId | null)[] = [null, "SKYPORT_ISLES", "NOVA_PRIME", "SUNKEN_DELTA", "CRYSTAL_REACH", "VERDANT_BASIN", "FROSTPEAK", "EMBER_WASTES", "OBSIDIAN_COAST"];

type Mode = "cinematic" | "static";
type Phase = "loading" | "arrival" | "city";

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

/**
 * The landing page. A small star spins while the scene loads, then shoots
 * across the screen and cuts it open on the planet; the ship is thrown at the
 * planet, burns through its air and comes out of the clouds over the island at
 * sunrise. Scrolling then flies the camera around the island, one district per
 * section, and the citizens' registry (the portal's sign-in) opens at the city
 * hall of Nova Prime. Three.js, the scroll libraries and the sound load only
 * in the browser and only in cinematic mode; reduced motion, eco mode and
 * devices without WebGL get the same content on a still backdrop.
 */
export function CinematicLanding({
  data,
  registry: request,
}: {
  readonly data: LandingData;
  readonly registry: RegistryRequest | null;
}) {
  const t = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<LandingStage | null>(null);
  const tourRef = useRef<Tour | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const skipRef = useRef<() => void>(() => {});
  const requestRef = useRef(request);
  const [mode, setMode] = useState<Mode | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [registry, setRegistry] = useState<RegistryView | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const cue = useCallback((name: SoundCue, detail?: number) => soundRef.current?.cue(name, detail), []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const intro = introRef.current;
    if (!root || !canvas || !intro) return;
    const chosen = pickMode();
    setMode(chosen);

    let disposed = false;
    const cleanups: (() => void)[] = [];
    const html = document.documentElement;
    html.classList.add("tn-landing-active", "tn-intro-lock");
    cleanups.push(() => html.classList.remove("tn-landing-active", "tn-intro-lock", "tn-hold"));

    /** The page under the arrival becomes usable: scroll, sections, instruments. */
    const openCity = async (stage: LandingStage | null) => {
      const { createTour } = await import("./tour-timeline");
      if (disposed) return;
      html.classList.remove("tn-intro-lock");
      setPhase("city");
      // The sections must be laid out (visible) before their scroll positions are measured.
      requestAnimationFrame(() => {
        if (disposed) return;
        const tour = createTour(root, stage, stage !== null, {
          onStop: (index) => soundRef.current?.cue("stop", index),
          onPanel: () => soundRef.current?.cue("panel"),
        });
        tourRef.current = tour;
        cleanups.push(() => {
          tour.destroy();
          tourRef.current = null;
        });
        gsap.fromTo(root.querySelectorAll("[data-hero-item]"), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: "power3.out" });
        gsap.fromTo(root.querySelectorAll("[data-chapter='arrival'] .tn-line > span"), { yPercent: 110 }, { yPercent: 0, duration: 1.2, stagger: 0.1, ease: "power3.out" });
        gsap.fromTo(root.querySelectorAll(".tn-chrome, .tn-flight"), { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 0.5, ease: "power2.out" });
        if (requestRef.current) setRegistry(requestRef.current.view);
      });
    };

    const goStatic = async () => {
      setMode("static");
      intro.style.display = "none";
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

      const [{ LandingStage }, { LoaderStar }, { SoundEngine }] = await Promise.all([import("./stage/landing-stage"), import("./loader-star"), import("./sound")]);
      if (disposed) return;
      const starCanvas = intro.querySelector<HTMLCanvasElement>("[data-intro='star-canvas']");
      const star = starCanvas ? new LoaderStar(starCanvas) : null;
      star?.start();
      cleanups.push(() => star?.dispose());

      const sound = new SoundEngine();
      soundRef.current = sound;
      setSoundOn(sound.enabled);
      cleanups.push(() => {
        sound.dispose();
        soundRef.current = null;
      });
      // A browser lets sound start only on a click or a key: the first one unlocks it.
      const unlock = () => sound.unlock();
      const hover = (event: PointerEvent) => {
        if (event.pointerType === "mouse" && (event.target as Element).closest("a, button") && !(event.relatedTarget as Element | null)?.closest?.("a, button")) sound.cue("hover");
      };
      const click = (event: MouseEvent) => {
        if ((event.target as Element).closest("a, button")) sound.cue("click");
      };
      const visibility = () => sound.setPaused(document.visibilityState !== "visible");
      window.addEventListener("pointerdown", unlock);
      window.addEventListener("keydown", unlock);
      root.addEventListener("pointerover", hover);
      root.addEventListener("click", click);
      document.addEventListener("visibilitychange", visibility);
      cleanups.push(() => {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        root.removeEventListener("pointerover", hover);
        root.removeEventListener("click", click);
        document.removeEventListener("visibilitychange", visibility);
      });
      sound.ambience("space");

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
        stageRef.current = null;
      };
      stageRef.current = stage;
      cleanups.push(release);

      // The counter shows real progress: the planet's download, then the island being built.
      const counter = intro.querySelector<HTMLElement>("[data-intro='counter']");
      const shown = { value: 0 };
      const show = (value: number) =>
        gsap.to(shown, {
          value: value * 100,
          duration: 0.5,
          ease: "power1.out",
          overwrite: true,
          onUpdate: () => {
            if (counter) counter.textContent = String(Math.round(shown.value));
          },
        });
      try {
        await Promise.race([stage.load(show), new Promise((_, reject) => setTimeout(() => reject(new Error("stage timeout")), 30000))]);
      } catch {
        // No planet, or a graphics chip that cannot build the scene: the still version.
        release();
        return goStatic();
      }
      if (disposed) return;
      await show(1);
      if (disposed) return;
      stage.start();
      const state = stage.state;
      setPhase("arrival");

      const arrive = () => {
        try {
          window.sessionStorage.setItem(SEEN_KEY, "1");
        } catch {
          // Private mode: the arrival simply plays again next time.
        }
        stage.onBeacon = null;
        star?.dispose();
        sound.ambience("island");
        void openCity(stage);
      };

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      cleanups.push(() => timeline.kill());
      // Every arrival plays the planet and the star; only a visitor sent here to sign in lands at once.
      if (requestRef.current) {
        state.phase = "world";
        state.flash = 1;
        state.entry = 0.4;
        timeline
          .to(intro, { autoAlpha: 0, duration: 0.6, ease: "power2.inOut" }, 0)
          .to(state, { flash: 0, duration: 1.5, ease: "power2.out" }, 0.3)
          .to(state, { entry: 0, duration: 2.8, ease: "power3.out" }, 0.3)
          .add(arrive, 0.55);
        return;
      }

      // The full arrival.
      let skipped = false;
      const play = (name: SoundCue) => () => {
        if (!skipped) sound.cue(name);
      };
      const q = (selector: string) => intro.querySelector<HTMLElement>(selector);
      const starEl = q("[data-intro='star']");
      const slash = q("[data-intro='slash']");
      const beacon = root.querySelector<HTMLElement>("[data-arrival='beacon']");
      stage.onBeacon = (x, y, visible) => {
        if (!beacon) return;
        beacon.style.opacity = visible ? "1" : "0";
        beacon.style.transform = `translate3d(${x * window.innerWidth}px, ${y * window.innerHeight}px, 0)`;
      };
      // The seam runs from the bottom-left corner to the top-right one. The star
      // travels along it; the slash starts at the same point, has the same length
      // and direction and grows with the same timing, so its head is always the star.
      const dx = window.innerWidth * 1.02;
      const dy = -window.innerHeight * 1.02;
      gsap.set(slash, { width: Math.hypot(dx, dy), rotate: (Math.atan2(dy, dx) * 180) / Math.PI, scaleX: 0, transformOrigin: "0% 50%" });
      gsap.set("[data-arrival='title'] .tn-line > span", { yPercent: 110 });

      timeline
        // 1. The star shoots along the seam and the two halves of the screen part like a cut curtain.
        .to(q("[data-intro='label']"), { opacity: 0, y: 20, duration: 0.4, ease: "power2.in" })
        .to(star?.state ?? {}, { boost: 1, duration: 0.5, ease: "power2.in" }, "<")
        .to(starEl, { scale: 1.15, duration: 0.5, ease: "back.in(2)" }, "<")
        .addLabel("slash")
        .add(play("ignite"), "slash")
        .to(starEl, { x: dx, y: dy, scale: 0.5, rotate: 220, duration: 0.95, ease: "expo.in" }, "slash")
        .to(slash, { scaleX: 1, duration: 0.95, ease: "expo.in" }, "slash")
        .set(intro, { backgroundColor: "transparent" }, "slash+=0.7")
        .to(q("[data-intro='panel-a']"), { xPercent: -56, yPercent: -56, duration: 1.5, ease: "power4.inOut" }, "slash+=0.72")
        .to(q("[data-intro='panel-b']"), { xPercent: 56, yPercent: 56, duration: 1.5, ease: "power4.inOut" }, "slash+=0.72")
        .to(slash, { opacity: 0, duration: 0.6 }, "slash+=1.0")
        .set(intro, { display: "none" }, "slash+=2.3")
        // 2. The planet comes round and settles; its name rises.
        .addLabel("planet", "slash+=0.8")
        .to(state, { arrive: 1, duration: 4.4, ease: "power2.out" }, "planet")
        .to("[data-arrival='title'] .tn-line > span", { yPercent: 0, duration: 1.2, stagger: 0.14 }, "planet+=1.3")
        // 3. The flight: speed, the fire of entry, the white of the clouds.
        .addLabel("flight", "planet+=4.9")
        .to("[data-arrival='title']", { opacity: 0, duration: 0.5, ease: "power2.in" }, "flight-=0.3")
        .add(play("warp"), "flight")
        .to(state, { warp: 1, duration: 1.3, ease: "power2.in" }, "flight")
        .to(state, { dive: 1, duration: 2.9, ease: "power3.in" }, "flight+=0.1")
        .to(state, { shake: 1, duration: 2.2, ease: "power2.in" }, "flight+=0.6")
        .to(state, { heat: 1, duration: 0.9, ease: "power2.in" }, "flight+=1.9")
        .add(play("entry"), "flight+=2")
        .to(state, { flash: 1, duration: 0.6, ease: "power2.in" }, "flight+=2.4")
        .add(() => {
          state.phase = "world";
          state.entry = 1;
          state.dive = 0;
          state.warp = 0;
        }, "flight+=3.05")
        // 4. Out of the clouds, over the island.
        .to(state, { flash: 0, duration: 1.8, ease: "power2.out" }, "flight+=3.2")
        .to(state, { heat: 0, duration: 1.4, ease: "power2.out" }, "flight+=3.1")
        .to(state, { entry: 0, duration: 4.8, ease: "power3.out" }, "flight+=3.1")
        .to(state, { shake: 0, duration: 2.8, ease: "power2.out" }, "flight+=3.2")
        .to("[data-arrival='root']", { autoAlpha: 0, duration: 0.6 }, "flight+=4.7")
        .add(play("arrive"), "flight+=4.9")
        .add(arrive, "flight+=5");
      skipRef.current = () => {
        skipped = true;
        timeline.progress(1);
      };
    };

    void run();

    return () => {
      disposed = true;
      for (const cleanup of cleanups.reverse()) cleanup();
    };
  }, []);

  // The registry: the camera leaves the flight for the city hall, and comes back when it closes.
  const registryOpen = registry !== null;
  useEffect(() => {
    document.documentElement.classList.toggle("tn-hold", registryOpen);
    tourRef.current?.setPaused(registryOpen);
    const stage = stageRef.current;
    const tween = stage ? gsap.to(stage.state, { registry: registryOpen ? 1 : 0, duration: registryOpen ? 2.4 : 1.8, ease: "power2.inOut" }) : null;
    soundRef.current?.ambience(registryOpen ? "hall" : phase === "city" ? "island" : "space");
    return () => {
      tween?.kill();
    };
  }, [registryOpen, phase]);

  // Signing in and joining are the one sign-in page, with its own 3D scene.
  const openSignIn = useCallback(() => {
    cue("open");
    window.location.assign("/login");
  }, [cue]);
  const openJoin = useCallback(() => {
    cue("open");
    window.location.assign("/register");
  }, [cue]);
  const toggleSound = () => {
    const next = !soundOn;
    soundRef.current?.setEnabled(next);
    setSoundOn(next);
  };

  const hold = mode !== "static" && phase !== "city";

  return (
    <div
      ref={rootRef}
      className={`tn-landing relative min-h-dvh overflow-x-clip bg-[#02040b] text-white ${cabinetGrotesk.variable}`}
      data-mode={mode ?? "pending"}
      data-phase={phase}
      data-registry={registryOpen ? "" : undefined}
    >
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 size-full" />
      <canvas ref={starsRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 size-full" />
      <div aria-hidden className="tn-static-planet pointer-events-none fixed inset-x-0 bottom-0 z-[2]" />

      <div inert={registryOpen}>
        <LandingNav viewer={data.viewer} soundOn={soundOn} onSound={toggleSound} onRegistry={openSignIn} />

        <main id="content" inert={hold}>
          <section data-chapter="arrival" className="relative flex h-[100svh] flex-col justify-end">
            <div aria-hidden className="tn-veil" />
            <div data-hero="block" className="relative z-[3] flex flex-col items-start gap-5 px-5 pb-[15svh] sm:px-8 lg:pl-[230px]">
              <p data-hero-item className="tn-label flex items-center gap-3 text-white/80">
                <span aria-hidden className="h-px w-8 bg-white/60" />
                {t("tn.home.badge")}
              </p>
              <h1 className="tn-wordmark whitespace-nowrap text-[clamp(3rem,10vw,9.5rem)] leading-[0.88]">
                <span className="tn-line">
                  <span>Bubble</span>
                </span>
              </h1>
              <p data-hero-item className="max-w-[46ch] text-[0.9688rem] leading-relaxed text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.9)] sm:text-[1.0625rem]">
                {data.viewer ? t("tn.home.hello", { name: data.viewer.firstName }) + ", " : ""}
                {t("tn.home.subtitle")}
              </p>
              {data.viewer && data.viewer.openRequests > 0 ? (
                <Link data-hero-item href="/space" className="tn-link text-[0.875rem] [text-shadow:0_1px_14px_rgb(0_0_0/0.9)]">
                  {t("tn.home.open_requests", { count: data.viewer.openRequests })}
                </Link>
              ) : null}
              <div data-hero-item className="flex flex-wrap gap-3">
                {data.viewer ? (
                  <>
                    <Link href="/contact" className="tn-btn tn-btn--solid">
                      {t("tn.home.cta_request")}
                    </Link>
                    <Link href="/space" className="tn-btn tn-btn--line">
                      {t("tn.home.cta_space")}
                    </Link>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={openJoin} className="tn-btn tn-btn--solid">
                      {t("tn.home.cta_join")}
                    </button>
                    <Link href="/services" className="tn-btn tn-btn--line">
                      {t("tn.home.cta_services")}
                    </Link>
                  </>
                )}
              </div>
            </div>
            <span data-hero-item className="tn-label absolute bottom-6 left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-1 text-white/70">
              {t("tn.tour.scroll")}
              <ChevronDown className="tn-bounce size-4" aria-hidden />
            </span>
          </section>

          <LandingSections data={data} onRegister={openJoin} />
        </main>

        {/* The flight's two instruments: a ship going down the route, and the pointer to a landmark. */}
        <div className="tn-flight">
          <nav data-hud="rail" aria-label={t("tn.tour.progress")} className="tn-route hidden lg:block">
            <span aria-hidden className="tn-route-line" />
            <ol>
              {STOPS.map((zone, index) => (
                <li key={zone ?? "arrival"} style={{ "--at": index / (STOPS.length - 1) } as CSSProperties}>
                  <button type="button" data-hud="mark" className="tn-stop">
                    <span>{zone ? t(`alerts.zone.${zone}`) : t("tn.tour.stop.arrival")}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p aria-hidden className="tn-route-ship">
              <svg viewBox="0 0 19 26">
                <path className="tn-flame" fill="var(--tn-accent)" d="M9.5 0c2 2.6 2.6 4.6 2.2 7H7.3C6.9 4.600 7.500 2.600 9.500 0Z" />
                <path fill="currentColor" d="M5 7h9v9.500c0 3.600-2 6.600-4.500 9.500C7 23.100 5 20.100 5 16.500V7Z" />
                <path fill="currentColor" opacity="0.7" d="M5 9 1.500 12v4L5 14.500ZM14 9l3.500 3v4L14 14.500Z" />
                <circle cx="9.5" cy="15" r="1.8" fill="var(--tn-ink)" />
              </svg>
              <span data-hud="stop-name" className="text-[0.8125rem] font-semibold" />
            </p>
          </nav>
          <svg aria-hidden className="tn-pointer hidden lg:block">
            <g data-hud="pointer" opacity="0">
              <path data-hud="line" className="tn-pointer-edge" />
              <path data-hud="line" className="tn-pointer-core" />
              <circle data-hud="target" r="5" />
            </g>
          </svg>
          <p data-hud="tag" aria-hidden className="tn-tag hidden lg:block" />
        </div>
      </div>

      {mode === "cinematic" && phase !== "city" ? (
        <div data-arrival="root" className="tn-arrival">
          <p data-arrival="title" aria-hidden className="tn-wordmark absolute inset-x-0 top-[16svh] px-6 text-center text-[clamp(2.6rem,8.4vw,7.6rem)] leading-[0.9] sm:pl-[max(2.5rem,8vw)] sm:text-left">
            <span className="tn-line">
              <span>Terra</span>
            </span>{" "}
            <span className="tn-line">
              <span>
                <b>Nova</b>
              </span>
            </span>
          </p>
          <button type="button" onClick={() => skipRef.current()} className="tn-btn tn-btn--line absolute bottom-6 right-6 z-[61] py-2 text-[0.8125rem]">
            {t("tn.arrival.skip")}
          </button>
        </div>
      ) : null}

      {/*
        The preloader, kept quiet: a small star, a thin counter. Two panels share
        one diagonal seam, from the bottom-left corner to the top-right one; the
        star sits on that seam, so when it shoots along it the panels part like a
        curtain slashed open.
      */}
      <div ref={introRef} role="status" className="fixed inset-0 z-[60] bg-[#03050c]">
        <div data-intro="panel-a" className="tn-intro-panel absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]" />
        <div data-intro="panel-b" className="tn-intro-panel absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
        <div data-intro="slash" aria-hidden className="tn-slash absolute left-[4vw] top-[96vh] h-px origin-left" />
        {/* Centred on the seam (4vw + 96vh = one diagonal): negative margins, so GSAP transforms stay free. */}
        <div data-intro="star" aria-hidden className="absolute left-[4vw] top-[96vh] -ml-7 -mt-7 size-14 sm:-ml-8 sm:-mt-8 sm:size-16">
          <canvas data-intro="star-canvas" className="size-full" />
        </div>
        <div data-intro="label" className="absolute bottom-[calc(4vh+1.6rem)] left-[calc(4vw+2.25rem)] flex items-baseline gap-3 text-white">
          <span className="text-[1.375rem] font-light leading-none tabular-nums tracking-tight">
            <span data-intro="counter">0</span>
            <span className="text-white/40">%</span>
          </span>
          <span className="text-[0.625rem] uppercase tracking-[0.32em] text-white/40">{t("tn.arrival.loading")}</span>
        </div>
      </div>
    </div>
  );
}
