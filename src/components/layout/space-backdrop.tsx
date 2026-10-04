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
    const width = 1920;
    const height = 1200;
    element.width = width;
    element.height = height;
    const context = element.getContext("2d");
    if (!context) return;
    const random = seeded(2140);
    const noise = makeNoise(random);

    // 1) The diffuse light, computed per pixel at half size: a tilted band with a
    //    warm core, soft dust lanes and a wide faint halo. No blur needed, no blocks.
    const lowW = 640;
    const lowH = 400;
    const light = context.createImageData(lowW, lowH);
    const tilt = -0.38;
    const smooth = (edge0: number, edge1: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };
    for (let y = 0; y < lowH; y += 1) {
      for (let x = 0; x < lowW; x += 1) {
        const nx = x / lowW - 0.5;
        const ny = (y / lowH - 0.5) * (lowH / lowW);
        const across = -Math.sin(tilt) * nx + Math.cos(tilt) * ny;
        const along = Math.cos(tilt) * nx + Math.sin(tilt) * ny;
        // The band is thicker near the core and thins out along its length.
        const thickness = 0.055 + 0.05 * Math.exp(-(along * along) / 0.06);
        const band = Math.exp(-(across * across) / (2 * thickness * thickness));
        const core = Math.exp(-(along * along) / 0.09);
        const cloud = noise(x * 0.012 + 3, y * 0.016 + 9, 6);
        const fine = noise(x * 0.05 + 17, y * 0.06 + 31, 4);
        // Dust: darker filaments that follow the band, strongest near its middle.
        const dust = smooth(0.46, 0.7, noise(x * 0.02 + 40, y * 0.045 + 7, 5)) * Math.exp(-(across * across) / (2 * 0.03 * 0.03));
        let glow = band * (0.25 + 0.75 * core) * (0.55 + cloud * 0.75) * (0.85 + fine * 0.3);
        glow *= 1 - dust * 0.75;
        glow += Math.exp(-(across * across) / 0.06) * 0.05;
        const v = Math.min(1, glow) * 0.5;
        const warm = core * band;
        const k = (y * lowW + x) * 4;
        light.data[k] = 10 + v * (120 + warm * 120);
        light.data[k + 1] = 12 + v * (125 + warm * 85);
        light.data[k + 2] = 20 + v * (175 - warm * 10);
        light.data[k + 3] = 255;
      }
    }
    const small = document.createElement("canvas");
    small.width = lowW;
    small.height = lowH;
    small.getContext("2d")?.putImageData(light, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(small, 0, 0, width, height);

    // 2) Stars: thousands of pin-points, denser along the band, most of them faint.
    const palette = ["#b9c8ff", "#d7defc", "#ffffff", "#fff4e4", "#ffe2bd"];
    for (let i = 0; i < 5200; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const nx = x / width - 0.5;
      const ny = (y / height - 0.5) * (height / width);
      const across = -Math.sin(tilt) * nx + Math.cos(tilt) * ny;
      if (random() > 0.22 + 0.78 * Math.exp(-(across * across) / 0.02)) continue;
      const brightness = Math.pow(random(), 5);
      context.globalAlpha = 0.12 + brightness * 0.8;
      context.fillStyle = palette[Math.floor(random() * palette.length)] ?? "#fff";
      const size = brightness > 0.6 ? 1.6 : brightness > 0.2 ? 1.1 : 0.7;
      context.fillRect(x, y, size, size);
    }
    // 3) A handful of nearer stars: a tight core and a small, sharp glow.
    for (let i = 0; i < 9; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 3 + random() * 3;
      const halo = context.createRadialGradient(x, y, 0, x, y, radius);
      halo.addColorStop(0, "rgba(255,250,240,0.95)");
      halo.addColorStop(0.25, "rgba(255,240,220,0.35)");
      halo.addColorStop(1, "rgba(255,240,220,0)");
      context.globalAlpha = 1;
      context.fillStyle = halo;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // 4) The edges fall off into the dark, so content at the sides reads on a calm ground.
    const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.72);
    vignette.addColorStop(0, "rgba(10,12,18,0)");
    vignette.addColorStop(1, "rgba(10,12,18,0.6)");
    context.globalAlpha = 1;
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }, []);

  return <canvas ref={canvas} aria-hidden className="space-backdrop pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover" />;
}
