"use client";

import { useEffect } from "react";

/** A soft two-tone ring synthesised with Web Audio (no audio file to load). */
export function useRingtone(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined" || !("AudioContext" in window)) return;
    const context = new AudioContext();
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      for (const [offset, frequency] of [[0, 660], [0.25, 880]] as const) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.22);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + 0.25);
      }
    };
    ring();
    const timer = setInterval(ring, 2_000);
    return () => {
      stopped = true;
      clearInterval(timer);
      void context.close();
    };
  }, [active]);
}
