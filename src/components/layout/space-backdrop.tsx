"use client";

import { useEffect, useRef } from "react";

/** Small deterministic generator: the same sky on every visit. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Smooth value noise on a grid, summed over octaves. */
function makeNoise(random: () => number) {
  const size = 64;
  const grid = Float32Array.from({ length: size * size }, () => random());
  const at = (x: number, y: number) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)] ?? 0;
  const value = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return top + (bottom - top) * sy;
  };
  return (x: number, y: number, octaves = 5) => {
    let sum = 0;
    let amp = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i += 1) {
      sum += value(x * frequency, y * frequency) * amp;
      amp *= 0.5;
      frequency *= 2.03;
    }
    return sum;
  };
}

/**
 * The sky behind the app: a galaxy seen edge-on, drawn once from noise (a
 * diffuse band with dust lanes, thousands of stars of every temperature, a
 * few bright ones). No image to download, no animation, and it is only
 * visible in the dark theme, the one that goes with the landing.
 */
export function SpaceBackdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const width = 1280;
    const height = 800;
    element.width = width;
    element.height = height;
    const context = element.getContext("2d");
    if (!context) return;
    const random = seeded(2140);
    const noise = makeNoise(random);

    // 1) The diffuse light: a tilted band, thick in the middle, torn by dust.
    const lowW = 320;
    const lowH = 200;
    const light = context.createImageData(lowW, lowH);
    const tilt = -0.42;
    for (let y = 0; y < lowH; y += 1) {
      for (let x = 0; x < lowW; x += 1) {
        const nx = x / lowW - 0.5;
        const ny = y / lowH - 0.5;
        // Distance to the tilted axis of the galaxy.
        const across = (-Math.sin(tilt) * nx + Math.cos(tilt) * ny) * 2.1;
        const along = Math.cos(tilt) * nx + Math.sin(tilt) * ny;
        const band = Math.exp(-(across * across) / 0.075);
        const core = Math.exp(-(along * along) / 0.11) * 0.55 + 0.45;
        const cloud = noise(x * 0.045 + 3, y * 0.06 + 9, 5);
        const dust = noise(x * 0.09 + 40, y * 0.14 + 7, 4);
        // A dark lane along the middle of the band, broken by the noise.
        const lane = Math.exp(-((across - 0.06) * (across - 0.06)) / 0.006) * Math.max(0, dust - 0.38) * 3.2;
        const glow = Math.max(0, band * core * (0.35 + cloud * 0.95) - lane * 0.8);
        const haze = Math.exp(-(across * across) / 0.5) * 0.12;
        const k = (y * lowW + x) * 4;
        const v = Math.min(1, glow + haze) * 0.62;
        // Cold blue at the edge, warm cream in the core, a touch of violet between.
        light.data[k] = 18 + v * (150 + core * 90);
        light.data[k + 1] = 22 + v * (150 + core * 60);
        light.data[k + 2] = 38 + v * (190 - core * 20);
        light.data[k + 3] = 255;
      }
    }
    const small = document.createElement("canvas");
    small.width = lowW;
    small.height = lowH;
    small.getContext("2d")?.putImageData(light, 0, 0);
    context.fillStyle = "#0b0d13";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.filter = "blur(3px)";
    context.drawImage(small, -20, -20, width + 40, height + 40);
    context.filter = "none";

    // 2) Stars: many faint, denser where the galaxy is, colour by temperature.
    const palette = ["#aebfff", "#cfd9ff", "#ffffff", "#fff3e0", "#ffd9a8", "#ffb98a"];
    for (let i = 0; i < 2600; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;
      const across = (-Math.sin(tilt) * nx + Math.cos(tilt) * ny) * 2.1;
      // Stars thicken along the band: reject some of those far from it.
      if (random() > 0.35 + 0.65 * Math.exp(-(across * across) / 0.18)) continue;
      const brightness = Math.pow(random(), 3.2);
      context.globalAlpha = 0.18 + brightness * 0.82;
      context.fillStyle = palette[Math.floor(random() * palette.length)] ?? "#fff";
      const radius = 0.35 + brightness * 1.1;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    // 3) A dozen bright stars with a soft halo and a faint cross.
    for (let i = 0; i < 12; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const halo = context.createRadialGradient(x, y, 0, x, y, 14 + random() * 10);
      halo.addColorStop(0, "rgba(255,246,230,0.95)");
      halo.addColorStop(0.15, "rgba(255,236,210,0.35)");
      halo.addColorStop(1, "rgba(255,236,210,0)");
      context.globalAlpha = 1;
      context.fillStyle = halo;
      context.fillRect(x - 26, y - 26, 52, 52);
    }
    context.globalAlpha = 1;
  }, []);

  return <canvas ref={canvas} aria-hidden className="space-backdrop pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover" />;
}
