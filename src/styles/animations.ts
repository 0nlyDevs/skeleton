"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * GSAP helpers.
 *
 * Three rules hold everywhere in this file:
 *
 *   1. **Only `transform` and `opacity` animate.** Anything else forces layout
 *      on every frame and is what makes motion feel cheap.
 *   2. **`prefers-reduced-motion` wins.** Every helper returns immediately and
 *      leaves the element in its final, visible state. A user who asked for less
 *      motion gets a static — but complete — page, never a blank one.
 *   3. **Animations are fire-and-forget and reversible.** Each helper returns a
 *      cleanup function so a component unmounting mid-tween cannot leave a stale
 *      ScrollTrigger scrolling a detached node.
 *
 * Durations are short (0.35–0.6s) and easings are soft. Subtle is the point: the
 * motion should read as responsiveness, not as decoration.
 */

let pluginsRegistered = false;

export function registerGsapPlugins(): void {
  if (pluginsRegistered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  pluginsRegistered = true;
}

/** True when the visitor has asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface RevealOptions {
  /** Vertical travel in pixels. */
  readonly y?: number;
  readonly duration?: number;
  readonly delay?: number;
  readonly stagger?: number;
  /** Start a little before the element reaches the viewport edge. */
  readonly start?: string;
}

/**
 * Fade and lift elements in as they enter the viewport.
 * Returns a teardown that kills the tweens and their triggers.
 */
export function revealOnScroll(
  targets: gsap.TweenTarget,
  options: RevealOptions = {},
): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (prefersReducedMotion()) return () => undefined;

  registerGsapPlugins();

  const {
    y = 18,
    duration = 0.55,
    delay = 0,
    stagger = 0.06,
    start = "top 88%",
  } = options;

  const tween = gsap.from(targets, {
    opacity: 0,
    y,
    duration,
    delay,
    stagger,
    ease: "power2.out",
    scrollTrigger: {
      trigger: targets as gsap.DOMTarget,
      start,
      // Play once: re-animating on scroll-up is distracting on a dashboard.
      once: true,
    },
  });

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
  };
}

/** Count a number up from zero. Used by the dashboard and admin stat cards. */
export function animateNumber(
  element: HTMLElement,
  value: number,
  options: { duration?: number; format?: (n: number) => string } = {},
): () => void {
  if (prefersReducedMotion()) {
    element.textContent = (options.format ?? String)(value);
    return () => undefined;
  }

  const state = { current: 0 };
  const format = options.format ?? ((n: number) => Math.round(n).toLocaleString("fr-FR"));

  const tween = gsap.to(state, {
    current: value,
    duration: options.duration ?? 0.9,
    ease: "power1.out",
    onUpdate: () => {
      element.textContent = format(state.current);
    },
    onComplete: () => {
      element.textContent = format(value);
    },
  });

  return () => tween.kill();
}

/**
 * Entrance for a page or a panel: a single soft lift.
 * Deliberately not a full-screen transition — those slow navigation down and
 * break the back button's perceived immediacy.
 */
export function enterPanel(element: HTMLElement | null): () => void {
  if (!element || prefersReducedMotion()) return () => undefined;

  const tween = gsap.from(element, {
    opacity: 0,
    y: 8,
    duration: 0.4,
    ease: "power2.out",
  });

  return () => tween.kill();
}

/** Scale-in for a headline word. Kept for landing-page accents. */
export function popIn(element: HTMLElement | null, delay = 0): () => void {
  if (!element || prefersReducedMotion()) return () => undefined;

  const tween = gsap.from(element, {
    opacity: 0,
    scale: 0.94,
    duration: 0.5,
    delay,
    ease: "back.out(1.6)",
  });

  return () => tween.kill();
}

/** Detach every ScrollTrigger. Called on route change to avoid leaks. */
export function killAllScrollTriggers(): void {
  if (typeof window === "undefined") return;
  registerGsapPlugins();
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
}

export { gsap, ScrollTrigger };
