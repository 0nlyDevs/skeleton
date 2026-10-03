import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import type { LandingStage } from "./stage/landing-stage";

gsap.registerPlugin(ScrollTrigger);

/** Dawn is 06:10 on the island, night falls at 22:40. */
function clock(sol: number): string {
  const minutes = Math.round(370 + sol * 990);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export interface Tour {
  /** Freezes the scroll (the registry is open) or frees it again. */
  setPaused(paused: boolean): void;
  destroy(): void;
}

export interface TourEvents {
  /** The camera has reached another stop of the flight. */
  readonly onStop?: (index: number) => void;
  /** A panel has come into view. */
  readonly onPanel?: () => void;
}

/**
 * Everything the scroll drives once the visitor is over the island: smooth
 * inertia (Lenis), the camera's place on its flight (one stop per section),
 * the reveal of each panel, the counters, and the instruments: the route on
 * the left with its ship, the hour, and the pointer from a panel to its
 * landmark.
 */
export function createTour(root: HTMLElement, stage: LandingStage | null, smooth: boolean, events: TourEvents = {}): Tour {
  const lenis = smooth ? new Lenis({ duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) }) : null;
  const tick = (time: number) => lenis?.raf(time * 1000);
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }

  const chapters = gsap.utils.toArray<HTMLElement>("[data-chapter]", root);
  const marks = gsap.utils.toArray<HTMLElement>("[data-hud='mark']", root);
  const rail = root.querySelector<HTMLElement>("[data-hud='rail']");
  const clockLabel = root.querySelector<HTMLElement>("[data-hud='clock']");
  const countLabel = root.querySelector<HTMLElement>("[data-hud='count']");
  const tag = root.querySelector<HTMLElement>("[data-hud='tag']");
  const tagName = root.querySelector<HTMLElement>("[data-hud='tag-name']");
  const pointer = root.querySelector<SVGGElement>("[data-hud='pointer']");
  const lines = root.querySelectorAll<SVGPathElement>("[data-hud='line']");
  const reticle = root.querySelector<SVGGElement>("[data-hud='reticle']");
  let centres: number[] = [];
  let active = -1;
  let lastClock = "";

  const measure = () => {
    centres = chapters.map((chapter) => {
      const rect = chapter.getBoundingClientRect();
      return rect.top + window.scrollY + rect.height / 2;
    });
  };

  // The camera's place: 0 at the first section's middle, 1 at the second's, and so on.
  const follow = () => {
    if (centres.length < 2) return;
    const at = window.scrollY + window.innerHeight / 2;
    let index = 0;
    while (index < centres.length - 2 && at > (centres[index + 1] ?? Infinity)) index += 1;
    const from = centres[index] ?? 0;
    const to = centres[index + 1] ?? from + 1;
    const tour = Math.min(centres.length - 1, Math.max(0, index + (at - from) / (to - from)));
    if (stage) stage.state.tour = tour;
    rail?.style.setProperty("--tour", (tour / (centres.length - 1)).toFixed(4));

    const nearest = Math.round(tour);
    if (nearest !== active) {
      if (active >= 0) events.onStop?.(nearest);
      active = nearest;
      marks.forEach((mark, i) => mark.toggleAttribute("data-active", i === nearest));
      chapters.forEach((chapter, i) => chapter.toggleAttribute("data-current", i === nearest));
      if (countLabel) countLabel.textContent = String(nearest + 1).padStart(2, "0");
    }
    if (clockLabel && stage) {
      const text = clock(stage.sol);
      if (text !== lastClock) {
        lastClock = text;
        clockLabel.textContent = text;
      }
    }

    // The pointer from the current panel to its landmark in the scene.
    const anchor = stage?.anchor;
    const panel = chapters[nearest]?.querySelector<HTMLElement>("[data-panel]");
    if (!tag || !pointer || !reticle || !anchor?.visible || !panel) {
      if (tag) tag.style.opacity = "0";
      if (pointer) pointer.style.opacity = "0";
      return;
    }
    const rect = panel.getBoundingClientRect();
    const x = anchor.x * window.innerWidth;
    const y = anchor.y * window.innerHeight;
    const settled = 1 - Math.min(1, Math.abs(tour - nearest) / 0.4);
    const clear = x < rect.left - 40 || x > rect.right + 40 ? 1 : 0;
    const startX = x < rect.left ? rect.left : rect.right;
    const startY = Math.min(window.innerHeight - 60, Math.max(60, rect.top + Math.min(rect.height * 0.5, 140)));
    // A curve that leaves the panel level and arrives on the target from above.
    const bend = (x - startX) * 0.55;
    const path = `M${startX.toFixed(1)} ${startY.toFixed(1)} C${(startX + bend).toFixed(1)} ${startY.toFixed(1)} ${x.toFixed(1)} ${(y + (startY - y) * 0.55).toFixed(1)} ${x.toFixed(1)} ${(y + (startY > y ? 22 : -22)).toFixed(1)}`;
    lines.forEach((line) => line.setAttribute("d", path));
    reticle.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    pointer.style.opacity = String(settled * clear);
    tag.style.opacity = String(settled * clear);
    tag.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (tagName && tagName.textContent !== (panel.dataset.place ?? "")) tagName.textContent = panel.dataset.place ?? "";
  };

  const ctx = gsap.context(() => {
    // Without the 3D stage (reduced motion, eco mode), the content is simply there.
    if (!stage) return;
    // The first view lifts away as the flight begins.
    gsap.to("[data-hero='block']", {
      yPercent: -30,
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: "[data-chapter='arrival']", start: "top top", end: "70% top", scrub: true },
    });

    const defaults = { start: "top 85%", toggleActions: "play none none reverse" };
    gsap.utils.toArray<HTMLElement>("[data-reveal='fade']").forEach((element) => {
      gsap.fromTo(element, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power2.out", scrollTrigger: { trigger: element, ...defaults } });
    });
    gsap.utils.toArray<HTMLElement>("[data-reveal='slide-up']").forEach((element) => {
      gsap.fromTo(element, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: element, ...defaults } });
    });
    // Headlines rise line by line from behind a mask.
    gsap.utils.toArray<HTMLElement>("[data-reveal='lines']").forEach((element) => {
      gsap.fromTo(
        element.querySelectorAll(".tn-line > span"),
        { yPercent: 110 },
        { yPercent: 0, duration: 1, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: element, ...defaults } },
      );
    });
    gsap.utils.toArray<HTMLElement>("[data-reveal='stagger']").forEach((parent) => {
      gsap.fromTo(
        parent.children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: parent, ...defaults } },
      );
    });
    // A panel arrives like a drop of glass: it swells into place.
    gsap.utils.toArray<HTMLElement>("[data-panel]").forEach((panel) => {
      gsap.fromTo(
        panel,
        { opacity: 0, scale: 0.92, y: 60 },
        { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: panel, start: "top 90%", toggleActions: "play none none reverse", onEnter: () => events.onPanel?.() } },
      );
    });

    gsap.utils.toArray<HTMLElement>("[data-count]").forEach((element) => {
      const target = Number(element.dataset.count ?? 0);
      const value = { n: 0 };
      gsap.to(value, {
        n: target,
        duration: 2,
        ease: "power2.out",
        scrollTrigger: { trigger: element, start: "top 90%" },
        onUpdate: () => {
          element.textContent = String(Math.round(value.n));
        },
      });
    });
  }, root);

  measure();
  ScrollTrigger.addEventListener("refresh", measure);
  ScrollTrigger.refresh();
  gsap.ticker.add(follow);

  // The marks of the route jump to their section.
  const jump = (event: Event) => {
    const index = marks.indexOf(event.currentTarget as HTMLElement);
    const centre = centres[index];
    if (centre === undefined) return;
    const top = Math.max(0, centre - window.innerHeight / 2);
    if (lenis) lenis.scrollTo(top, { duration: 1.8 });
    else window.scrollTo({ top });
  };
  marks.forEach((mark) => mark.addEventListener("click", jump));

  return {
    setPaused(paused) {
      if (paused) lenis?.stop();
      else lenis?.start();
    },
    destroy() {
      marks.forEach((mark) => mark.removeEventListener("click", jump));
      gsap.ticker.remove(follow);
      ScrollTrigger.removeEventListener("refresh", measure);
      ctx.revert();
      if (lenis) {
        gsap.ticker.remove(tick);
        lenis.destroy();
      }
    },
  };
}
