"use client";

import type { ReactNode } from "react";

import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

/**
 * Reveal wrapper.
 *
 * Keeps GSAP out of the server components: the section markup stays server
 * rendered — so it is in the first HTML payload and indexable — while this thin
 * client boundary adds the entrance on top. When the visitor prefers reduced
 * motion the hook no-ops and the content is simply already there.
 */
export function RevealSection({
  children,
  className,
  selector,
  stagger = 0.05,
  delay = 0,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly selector?: string;
  readonly stagger?: number;
  readonly delay?: number;
}) {
  const ref = useReveal<HTMLDivElement>({
    ...(selector ? { selector } : {}),
    stagger,
    delay,
  });

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
