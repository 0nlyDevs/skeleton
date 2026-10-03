"use client";

import { ChevronDown } from "lucide-react";
import gsap from "gsap";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import type { CityZoneId, ZoneStatusId } from "@/modules/alerts/city-zones";

import { CitizenRegistry, type RegistryView } from "./citizen-registry";
import { geologica, martianMono, unbounded } from "./landing-fonts";
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

/*
 * What bends the view at the edge of a pane of glass: red moves the picture
 * sideways, green up or down, mid-grey leaves it alone. Only a band along each
 * edge is not grey, so only the rim refracts, like a thick lens.
 */
const LENS = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" preserveAspectRatio="none"><defs><linearGradient id="x"><stop offset="0" stop-color="#f00"/><stop offset=".16" stop-color="#800000"/><stop offset=".84" stop-color="#800000"/><stop offset="1" stop-color="#000"/></linearGradient><linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="#0f0"/><stop offset=".16" stop-color="#008000"/><stop offset=".84" stop-color="#008000"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="200" height="200"/><rect width="200" height="200" fill="url(#x)"/><rect width="200" height="200" fill="url(#y)" style="mix-blend-mode:screen"/></svg>',
)}`;

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

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The landing page. A star ignites while the scene loads; the planet swings in
 * beside it; the ship is thrown at the planet, burns through its air and comes
 * out of the clouds over the island at sunrise. Scrolling then flies the
 * camera around the island, one district per section, and the citizens'
 * registry (the portal's sign-in) opens at the city hall of Nova Prime.
 * Three.js, the scroll libraries and the sound load only in the browser and
 * only in cinematic mode; reduced motion, eco mode and devices without WebGL
 * get the same content on a still backdrop.
 */
export function CinematicLanding({
  data,
  registry: request,
  oauth,
}: {
  readonly data: LandingData;
  readonly registry: RegistryRequest | null;
  readonly oauth: { readonly google: boolean; readonly github: boolean };
}) {
  const t = useTranslation();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderStarRef = useRef<HTMLCanvasElement>(null);
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
    const loader = loaderRef.current;
    if (!root || !canvas || !loader) return;
    const chosen = pickMode();
    setMode(chosen);

    let disposed = false;
    const cleanups: (() => void)[] = [];
    const html = document.documentElement;
    html.classList.add("tn-landing-active", "tn-intro-lock");
    cleanups.push(() => html.classList.remove("tn-landing-active", "tn-intro-lock", "tn-hold"));
    // Glass that bends what is behind it needs an SVG filter as a backdrop: Chromium only.
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
    if (brands?.some((entry) => entry.brand === "Chromium")) root.classList.add("tn-refract");

    // Light follows the pointer under the surface of each pane.
    const shine = (event: PointerEvent) => {
      const pane = (event.target as Element).closest<HTMLElement>(".lg");
      if (!pane) return;
      const rect = pane.getBoundingClientRect();
      pane.style.setProperty("--mx", `${(event.clientX - rect.left).toFixed(0)}px`);
      pane.style.setProperty("--my", `${(event.clientY - rect.top).toFixed(0)}px`);
    };
    root.addEventListener("pointermove", shine, { passive: true });
    cleanups.push(() => root.removeEventListener("pointermove", shine));

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

      // The star is on screen at once: it needs nothing but a 2D canvas.
      const { LoaderStar } = await import("./loader-star");
      if (disposed || !loaderStarRef.current) return;
      const star = new LoaderStar(loaderStarRef.current);
      star.start();
      cleanups.push(() => star.dispose());

      const [{ LandingStage }, { SoundEngine }] = await Promise.all([import("./stage/landing-stage"), import("./sound")]);
      if (disposed) return;
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

      // The ring around the star fills with real progress: the planet's download, then the island being built.
      const count = loader.querySelector<HTMLElement>("[data-loader='count']");
      const show = (value: number) =>
        gsap.to(star.state, {
          progress: value,
          duration: 0.5,
          ease: "power1.out",
          overwrite: true,
          onUpdate: () => {
            if (count) count.textContent = String(Math.round(star.state.progress * 100));
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
        star.dispose();
        sound.ambience("island");
        void openCity(stage);
      };

      const timeline = gsap.timeline();
      cleanups.push(() => timeline.kill());
      // A visitor who has already landed in this tab, or who was sent here to sign in, lands at once.
      if (readSeen() || requestRef.current) {
        state.phase = "world";
        state.flash = 1;
        state.entry = 0.4;
        timeline
          .to(loader, { autoAlpha: 0, duration: 0.6, ease: "power2.inOut" }, 0)
          .to(state, { flash: 0, duration: 1.5, ease: "power2.out" }, 0.3)
          .to(state, { entry: 0, duration: 2.8, ease: "power3.out" }, 0.3)
          .add(arrive, 0.55);
        return;
      }

      // The full arrival: the star, the planet, the flight, the fire, the clouds, the island.
      let skipped = false;
      const play = (name: SoundCue) => () => {
        if (!skipped) sound.cue(name);
      };
      const beacon = root.querySelector<HTMLElement>("[data-arrival='beacon']");
      const altitude = root.querySelector<HTMLElement>("[data-arrival='altitude']");
      stage.onBeacon = (x, y, visible) => {
        if (!beacon) return;
        beacon.style.opacity = visible ? "1" : "0";
        beacon.style.transform = `translate3d(${x * window.innerWidth}px, ${y * window.innerHeight}px, 0)`;
      };
      const fall = { km: 374 };
      gsap.set("[data-arrival='title'] .tn-line > span", { yPercent: 110 });
      timeline
        .add(play("ignite"), 0)
        .to(star.state, { flare: 1, duration: 0.9, ease: "power2.in" }, 0)
        .to(loader, { autoAlpha: 0, duration: 0.9, ease: "power2.inOut" }, 0.4)
        .to(state, { arrive: 1, duration: 4.8, ease: "power2.inOut" }, 0.5)
        .to("[data-arrival='title'] .tn-line > span", { yPercent: 0, duration: 1.2, stagger: 0.14, ease: "power3.out" }, 2.2)
        .fromTo("[data-arrival='caption']", { opacity: 0 }, { opacity: 1, duration: 0.9 }, 2.7)
        .add(play("lock"), 5.3)
        .fromTo("[data-arrival='lock']", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 5.3)
        .to("[data-arrival='words']", { opacity: 0, duration: 0.5 }, 5.7)
        .add(play("warp"), 5.9)
        .to(state, { warp: 1, duration: 1.3, ease: "power2.in" }, 5.9)
        .to(state, { dive: 1, duration: 2.9, ease: "power3.in" }, 6)
        .to(state, { shake: 1, duration: 2.2, ease: "power2.in" }, 6.5)
        .to(
          fall,
          {
            km: 0.4,
            duration: 5.6,
            ease: "power2.in",
            onUpdate: () => {
              if (altitude) altitude.textContent = fall.km > 10 ? fall.km.toFixed(0) : fall.km.toFixed(1);
            },
          },
          6,
        )
        .to(state, { heat: 1, duration: 0.9, ease: "power2.in" }, 7.8)
        .add(play("entry"), 7.9)
        .to(state, { flash: 1, duration: 0.6, ease: "power2.in" }, 8.3)
        .add(() => {
          state.phase = "world";
          state.entry = 1;
          state.dive = 0;
          state.warp = 0;
        }, 8.95)
        .to(state, { flash: 0, duration: 1.8, ease: "power2.out" }, 9.1)
        .to(state, { heat: 0, duration: 1.4, ease: "power2.out" }, 9)
        .to(state, { entry: 0, duration: 4.8, ease: "power3.out" }, 9)
        .to(state, { shake: 0, duration: 2.8, ease: "power2.out" }, 9.1)
        .to("[data-arrival='root']", { autoAlpha: 0, duration: 0.6 }, 10.6)
        .add(play("arrive"), 10.8)
        .add(arrive, 10.9);
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
    const open = registryOpen;
    document.documentElement.classList.toggle("tn-hold", open);
    tourRef.current?.setPaused(open);
    const stage = stageRef.current;
    const tween = stage ? gsap.to(stage.state, { registry: open ? 1 : 0, duration: open ? 2.4 : 1.8, ease: "power2.inOut" }) : null;
    soundRef.current?.ambience(open ? "hall" : phase === "city" ? "island" : "space");
    return () => {
      tween?.kill();
    };
  }, [registryOpen, phase]);

  const openRegistry = useCallback(() => {
    cue("open");
    setRegistry("signin");
  }, [cue]);
  const closeRegistry = useCallback(() => {
    cue("close");
    setRegistry(null);
    // Leave no trace of the request in the address: a reload must not reopen the registry.
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [cue]);
  const enter = useCallback(() => {
    router.push(request?.redirectTo ?? "/space");
    router.refresh();
  }, [router, request]);
  const toggleSound = () => {
    const next = !soundOn;
    soundRef.current?.setEnabled(next);
    setSoundOn(next);
  };

  const hold = mode !== "static" && phase !== "city";

  return (
    <div
      ref={rootRef}
      className={`tn-landing relative min-h-dvh overflow-x-clip bg-[#02040b] text-white ${unbounded.variable} ${geologica.variable} ${martianMono.variable}`}
      data-mode={mode ?? "pending"}
      data-phase={phase}
      data-registry={registryOpen ? "" : undefined}
    >
      <svg aria-hidden width="0" height="0" className="absolute">
        <filter id="tn-liquid" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={LENS} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lens" />
          <feDisplacementMap in="SourceGraphic" in2="lens" scale="46" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 size-full" />
      <canvas ref={starsRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 size-full" />
      <div aria-hidden className="tn-static-planet pointer-events-none fixed inset-x-0 bottom-0 z-[2]" />

      <div inert={registry !== null}>
        <LandingNav viewer={data.viewer} soundOn={soundOn} onSound={toggleSound} onRegistry={openRegistry} />

        <main id="content" inert={hold}>
          <section data-chapter="arrival" className="relative flex h-[100svh] flex-col justify-end">
            <div aria-hidden className="tn-veil" />
            <div data-hero="block" className="relative z-[3] flex flex-col items-start gap-5 px-5 pb-[17svh] sm:px-[max(2.5rem,7vw)] lg:pl-[270px]">
              <p data-hero-item className="tn-label flex items-center gap-3 text-white/80">
                <span aria-hidden className="h-px w-8 bg-[var(--tn-accent)]" />
                {t("tn.home.badge")}
              </p>
              <h1 className="tn-wordmark whitespace-nowrap text-[clamp(2.1rem,7.2vw,6.9rem)] leading-[0.9]">
                <span className="tn-line">
                  <span>TERRA</span>
                </span>{" "}
                <span className="tn-line">
                  <span>
                    <b>NOVA</b>
                  </span>
                </span>
              </h1>
              <p data-hero-item className="max-w-[48ch] text-[0.9375rem] font-normal leading-relaxed text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.9)] sm:text-[1.0625rem]">
                {data.viewer ? t("tn.home.hello", { name: data.viewer.firstName }) + " — " : ""}
                {t("tn.home.subtitle")}
              </p>
              {data.viewer && data.viewer.openRequests > 0 ? (
                <Link data-hero-item href="/space" className="tn-figure text-[0.75rem] text-[var(--tn-accent)] underline-offset-4 [text-shadow:0_1px_14px_rgb(0_0_0/0.9)] hover:underline">
                  {t("tn.home.open_requests", { count: data.viewer.openRequests })}
                </Link>
              ) : null}
              <div data-hero-item className="flex flex-wrap gap-3">
                {data.viewer ? (
                  <>
                    <Link href="/contact" className="lg-btn lg-btn--amber">
                      {t("tn.home.cta_request")}
                    </Link>
                    <Link href="/space" className="lg-btn">
                      {t("tn.home.cta_space")}
                    </Link>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setRegistry("register")} className="lg-btn lg-btn--amber">
                      {t("tn.registry.tab_register")}
                    </button>
                    <Link href="/services" className="lg-btn">
                      {t("tn.home.cta_services")}
                    </Link>
                  </>
                )}
              </div>
            </div>
            <span data-hero-item className="tn-label absolute bottom-[92px] left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-1 text-white/70">
              {t("tn.tour.scroll")}
              <ChevronDown className="tn-bounce size-4" aria-hidden />
            </span>
          </section>

          <LandingSections data={data} onRegister={() => setRegistry("register")} />
        </main>

        {/* Instruments of the flight: the route and its ship, the hour, the pointer to a landmark. */}
        <div className="tn-flight">
          <nav data-hud="rail" aria-label={t("tn.tour.progress")} className="tn-rail hidden lg:block">
            <p className="tn-rail-readout tn-rail-readout--top">
              <span className="tn-label">{t("tn.tour.clock")}</span>
              <strong data-hud="clock">06:10</strong>
            </p>
            <span aria-hidden className="tn-rail-line" />
            <span aria-hidden className="tn-rail-fill" />
            <span aria-hidden className="tn-rail-ship" />
            <ol>
              {STOPS.map((zone, index) => (
                <li key={zone ?? "arrival"} style={{ "--at": index / (STOPS.length - 1) } as CSSProperties}>
                  <button type="button" data-hud="mark" className="tn-mark">
                    <span>
                      <i>{String(index + 1).padStart(2, "0")}</i>
                      {zone ? t(`alerts.zone.${zone}`) : t("tn.tour.stop.arrival")}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p aria-hidden className="tn-rail-readout tn-rail-readout--bottom">
              <span className="tn-label">Sol 214</span>
              <strong>
                <span data-hud="count">01</span>
                <span className="text-white/45"> / {String(STOPS.length).padStart(2, "0")}</span>
              </strong>
            </p>
          </nav>
          <svg aria-hidden className="tn-pointer hidden lg:block">
            <g data-hud="pointer" opacity="0">
              <path data-hud="line" />
              <path data-hud="line" />
              <g data-hud="reticle" className="tn-reticle">
                <circle r="24" className="tn-reticle-spin" />
                <circle r="13" className="tn-reticle-pulse" />
                <circle r="13" />
                <path d="M-34 0h14M20 0h14M0-34v14M0 20v14" />
                <circle r="2.5" className="tn-reticle-core" />
              </g>
            </g>
          </svg>
          <p data-hud="tag" aria-hidden className="lg tn-tag hidden lg:flex">
            <span data-hud="tag-name" />
          </p>
        </div>
      </div>

      {registry ? (
        <CitizenRegistry
          view={registry}
          redirectTo={request?.redirectTo ?? "/space"}
          initialError={request?.errorKey ?? null}
          oauth={oauth}
          onView={setRegistry}
          onClose={closeRegistry}
          onGranted={enter}
          onCue={cue}
        />
      ) : null}

      {mode === "cinematic" && phase !== "city" ? (
        <div data-arrival="root" className="tn-arrival">
          <div data-arrival="words" className="absolute inset-x-0 top-[15svh] flex flex-col items-center gap-4 px-6 text-center sm:items-start sm:pl-[max(2.5rem,8vw)] sm:text-left">
            <p data-arrival="caption" aria-hidden className="tn-label text-white/70 opacity-0">
              {t("tn.arrival.system")}
            </p>
            <p data-arrival="title" aria-hidden className="tn-wordmark text-[clamp(2.2rem,7.6vw,6.6rem)] leading-[0.9]">
              <span className="tn-line">
                <span>TERRA</span>
              </span>{" "}
              <span className="tn-line">
                <span>
                  <b>NOVA</b>
                </span>
              </span>
            </p>
          </div>
          <p data-arrival="beacon" aria-hidden className="lg tn-tag">
            {t("tn.arrival.beacon")}
          </p>
          <p data-arrival="lock" aria-hidden className="absolute inset-x-0 bottom-[15svh] flex flex-col items-center gap-2 text-center opacity-0">
            <span className="tn-label text-[var(--tn-accent)]">
              {t("tn.arrival.locked")} · {t("tn.arrival.target")}
            </span>
            <span className="tn-figure text-[2.25rem] font-light [text-shadow:0_2px_24px_rgb(0_0_0/0.7)]">
              <span data-arrival="altitude">374</span> km
            </span>
          </p>
          <div className="absolute bottom-6 right-6 flex items-center gap-3">
            <span aria-hidden className="tn-label hidden text-white/50 sm:block">
              {t("tn.sound.hint")}
            </span>
            <button type="button" onClick={() => skipRef.current()} className="lg-btn">
              {t("tn.arrival.skip")}
            </button>
          </div>
        </div>
      ) : null}

      <div ref={loaderRef} role="status" className="tn-loader">
        <canvas ref={loaderStarRef} aria-hidden />
        <div className="tn-loader-readout">
          <p className="tn-display text-[0.75rem] font-semibold tracking-[0.42em]">TERRA NOVA</p>
          <p className="tn-label text-white/60">
            {t("tn.arrival.loading")} · <span data-loader="count">0</span>%
          </p>
        </div>
      </div>
    </div>
  );
}
