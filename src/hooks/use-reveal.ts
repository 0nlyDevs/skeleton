"use client";

import { useEffect, useRef } from "react";

import { killAllScrollTriggers, revealOnScroll } from "@/styles/animations";

/**
 * Reveal children as a container scrolls into view.
 *
 * `useLayoutEffect` is avoided on purpose: animating before paint would show the
 * elements in their final position for a frame and then jump them down, which
 * looks worse than no animation. The ref callback runs after mount, and everything
 * is torn down on unmount so a fast navigation cannot leave orphan triggers.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: {
  /** CSS selector for the children to stagger. Defaults to direct children. */
  readonly selector?: string;
  readonly y?: number;
  readonly delay?: number;
  readonly stagger?: number;
  readonly disabled?: boolean;
} = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || options.disabled) return;

    const targets = options.selector
      ? container.querySelectorAll(options.selector)
      : Array.from(container.children);

    if (targets.length === 0) return;

    const cleanup = revealOnScroll(targets, {
      y: options.y,
      delay: options.delay,
      stagger: options.stagger,
    });

    return () => {
      cleanup();
      killAllScrollTriggers();
    };
  }, [options.selector, options.y, options.delay, options.stagger, options.disabled]);

  return ref;
}
