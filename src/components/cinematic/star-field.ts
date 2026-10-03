/**
 * Background sky, drawn the way long-exposure space photographs look:
 *
 *   * pin-point stars with a steep brightness power law (thousands of faint
 *     ones, a handful of bright ones), near-white with a slight warm or cool
 *     cast, no halos and no twinkle;
 *   * a faint Milky Way: a diagonal band where faint stars crowd together,
 *     a soft unresolved glow along it, and a darker dust lane down its middle.
 *
 * Each depth layer is painted once into an offscreen canvas per resize; a
 * frame only re-composites the layers with a small scroll parallax.
 */

const TINTS = ["255 255 255", "255 248 238", "238 243 255", "255 238 220", "228 237 255"];

/** Smooth value noise, so star density clumps and thins like a real field. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * sx;
  const bottom = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * sx;
  return top + (bottom - top) * sy;
}

function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class StarField {
  private readonly context: CanvasRenderingContext2D;
  private layers: { canvas: HTMLCanvasElement; depth: number }[] = [];
  private frame = 0;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private lastScroll = -1;
  private readonly onResize = () => this.resize();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas unavailable");
    this.context = context;
    this.resize();
    window.addEventListener("resize", this.onResize);
  }

  private resize(): void {
    this.ratio = Math.min(window.devicePixelRatio, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.ratio;
    this.canvas.height = this.height * this.ratio;
    this.layers = [this.paintLayer(0.06, true), this.paintLayer(0.16, false)];
    this.lastScroll = -1;
  }

  /** One tall layer (1.6 screens), so the parallax never runs out of sky. */
  private paintLayer(depth: number, galaxy: boolean): { canvas: HTMLCanvasElement; depth: number } {
    const w = this.width;
    const h = Math.round(this.height * 1.6);
    const layer = document.createElement("canvas");
    layer.width = w * this.ratio;
    layer.height = h * this.ratio;
    const c = layer.getContext("2d");
    if (!c) return { canvas: layer, depth };
    c.scale(this.ratio, this.ratio);

    // The band: a line across the sky, from lower left to upper right.
    const angle = -0.42;
    const cx = w * 0.55;
    const cy = h * 0.32;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const normal = { x: -dir.y, y: dir.x };
    const bandWidth = Math.min(w, h) * 0.16;

    if (galaxy) this.paintGalaxyGlow(c, w, h, { cx, cy, dir, normal, bandWidth });

    // Stars: a uniform field plus, on the far layer, a crowd of faint ones in the band.
    const uniform = Math.round((w * h) / (galaxy ? 2600 : 7000));
    const crowded = galaxy ? Math.round((w * h) / 900) : 0;
    for (let i = 0; i < uniform + crowded; i += 1) {
      let x: number;
      let y: number;
      if (i < uniform) {
        // Rejection sampling against a noise field: clusters and empty patches.
        do {
          x = Math.random() * w;
          y = Math.random() * h;
        } while (Math.random() > Math.pow(noise(x / 260, y / 260) * 0.7 + noise(x / 90, y / 90) * 0.3, 1.8) * 1.6);
      } else {
        const along = (Math.random() - 0.5) * Math.hypot(w, h) * 1.1;
        const across = gaussian() * bandWidth * 0.45;
        x = cx + dir.x * along + normal.x * across;
        y = cy + dir.y * along + normal.y * across;
      }
      const magnitude = Math.pow(Math.random(), i < uniform ? 5 : 9);
      const r = 0.3 + magnitude * (galaxy ? 0.9 : 1.3);
      const alpha = (i < uniform ? 0.22 : 0.14) + magnitude * 0.75;
      c.fillStyle = `rgb(${TINTS[Math.floor(Math.random() * TINTS.length)]} / ${alpha})`;
      if (r < 0.7) {
        c.fillRect(x, y, r * 1.3, r * 1.3);
      } else {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    return { canvas: layer, depth };
  }

  /**
   * The Milky Way's unresolved light and its dust lane. Painted on a small
   * canvas with stronger alphas, scaled up smoothly and dithered with grain,
   * so the soft light never shows 8-bit banding.
   */
  private paintGalaxyGlow(
    target: CanvasRenderingContext2D,
    w: number,
    h: number,
    band: { cx: number; cy: number; dir: { x: number; y: number }; normal: { x: number; y: number }; bandWidth: number },
  ): void {
    const factor = 6;
    const small = document.createElement("canvas");
    small.width = Math.ceil(w / factor);
    small.height = Math.ceil(h / factor);
    const g = small.getContext("2d");
    if (!g) return;
    g.scale(1 / factor, 1 / factor);
    const { cx, cy, dir, normal, bandWidth } = band;
    const length = Math.hypot(w, h);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 120; i += 1) {
      const along = (Math.random() - 0.5) * length * 1.1;
      const across = gaussian() * bandWidth * 0.55;
      const x = cx + dir.x * along + normal.x * across;
      const y = cy + dir.y * along + normal.y * across;
      const r = bandWidth * (0.6 + Math.random() * 0.9);
      const gradient = g.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, Math.random() < 0.3 ? "rgb(255 236 214 / 0.07)" : "rgb(205 218 255 / 0.06)");
      gradient.addColorStop(1, "rgb(0 0 0 / 0)");
      g.fillStyle = gradient;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 60; i += 1) {
      const along = (Math.random() - 0.5) * length * 0.9;
      const across = gaussian() * bandWidth * 0.12 + Math.sin(along / 180) * bandWidth * 0.15;
      const x = cx + dir.x * along + normal.x * across;
      const y = cy + dir.y * along + normal.y * across;
      const r = bandWidth * (0.18 + Math.random() * 0.3);
      const gradient = g.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, "rgb(0 0 0 / 0.5)");
      gradient.addColorStop(1, "rgb(0 0 0 / 0)");
      g.fillStyle = gradient;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    target.save();
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = "high";
    target.filter = "blur(10px)";
    target.globalAlpha = 0.55;
    target.drawImage(small, 0, 0, w, h);
    target.restore();

    // Fine grain over the glow, as on a photograph; it also breaks up banding.
    const grainSize = 160;
    const grain = document.createElement("canvas");
    grain.width = grainSize;
    grain.height = grainSize;
    const gg = grain.getContext("2d");
    if (!gg) return;
    const pixels = gg.createImageData(grainSize, grainSize);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const v = Math.random() * 255;
      pixels.data[i] = v;
      pixels.data[i + 1] = v;
      pixels.data[i + 2] = v;
      pixels.data[i + 3] = 7;
    }
    gg.putImageData(pixels, 0, 0);
    const pattern = target.createPattern(grain, "repeat");
    if (pattern) {
      target.fillStyle = pattern;
      target.fillRect(0, 0, w, h);
    }
  }

  start(): void {
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      if (document.visibilityState !== "visible") return;
      const scroll = window.scrollY;
      if (scroll === this.lastScroll) return;
      this.lastScroll = scroll;
      this.draw(scroll);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private draw(scroll: number): void {
    const { context: c } = this;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const layer of this.layers) {
      const span = layer.canvas.height;
      const offset = (((scroll * layer.depth * this.ratio) % span) + span) % span;
      c.drawImage(layer.canvas, 0, -offset);
      if (span - offset < this.canvas.height) c.drawImage(layer.canvas, 0, span - offset);
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.onResize);
  }
}
