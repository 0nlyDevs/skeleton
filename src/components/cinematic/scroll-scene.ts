import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import type { PlanetStage } from "./planet-stage";

gsap.registerPlugin(ScrollTrigger);

/**
 * Everything the scroll drives: smooth inertia (Lenis), the title lifting
 * away, the planet travelling beside each section, reveals and counters.
 * Returns a cleanup that kills every trigger it created.
 */
export function createScrollScene(root: HTMLElement, stage: PlanetStage | null, smooth: boolean): () => void {
  const lenis = smooth ? new Lenis({ duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) }) : null;
  const tick = (time: number) => lenis?.raf(time * 1000);
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }

  const ctx = gsap.context(() => {
    // The hero title rises and fades as the page starts to move.
    gsap.to('[data-hero="title-wrap"]', {
      yPercent: -60,
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: '[data-scene="hero"]', start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to('[data-hero="hero-ui"], [data-hero="scrim"]', {
      y: -80,
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: '[data-scene="hero"]', start: "15% top", end: "70% top", scrub: true },
    });

    // The planet leaves the horizon and travels beside each section.
    if (stage) {
      const path = gsap.timeline({
        defaults: { ease: "sine.inOut" },
        scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 1.2 },
      });
      const s = stage.state;
      path
        .to(s, { x: 2.1, y: 4.5, scale: 0.42, tilt: -0.25, duration: 1 })
        .to(s, { x: 2.3, y: 4.6, scale: 0.4, duration: 0.6 })
        .to(s, { x: -2.6, y: 4.7, scale: 0.36, tilt: 0.3, duration: 1 })
        .to(s, { x: -2.4, y: 4.5, scale: 0.44, duration: 0.8 })
        .to(s, { x: 0, y: 3.2, scale: 0.7, tilt: 0, duration: 1 })
        .to(s, { x: 0, y: 1.2, scale: 1.05, opacity: 0.55, duration: 1 });
    }

    // Reveals.
    gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
      gsap.fromTo(
        element,
        { y: 40, opacity: 0, filter: "blur(8px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 88%" } },
      );
    });
    gsap.utils.toArray<HTMLElement>("[data-reveal-stagger]").forEach((list) => {
      gsap.fromTo(
        list.children,
        { y: 50, opacity: 0, rotateX: -12 },
        { y: 0, opacity: 1, rotateX: 0, duration: 1, stagger: 0.09, ease: "power3.out", scrollTrigger: { trigger: list, start: "top 85%" } },
      );
    });

    // Counters.
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

  ScrollTrigger.refresh();
  return () => {
    ctx.revert();
    if (lenis) {
      gsap.ticker.remove(tick);
      lenis.destroy();
    }
  };
}
