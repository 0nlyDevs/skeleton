/**
 * The loader's star, drawn the way a telescope sees one: a white-hot core, a
 * warm halo, four long diffraction spikes and four faint ones, a thin ring of
 * colour from the lens, and a slight flicker. Around it, a ring fills with the
 * real loading progress. It is a plain 2D canvas, so it is on screen before
 * the 3D scene has even downloaded; that scene opens on the same star.
 */
export class LoaderStar {
  /** `progress` 0 → 1 fills the ring; `flare` 0 → 1 floods the view with light on the way out. */
  readonly state = { progress: 0, flare: 0 };

  private readonly context: CanvasRenderingContext2D | null;
  private readonly dust: readonly { x: number; y: number; size: number; phase: number }[];
  private frame = 0;
  private born = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext("2d");
    let seed = 41;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    this.dust = Array.from({ length: 90 }, () => ({ x: random(), y: random(), size: 0.4 + random() ** 3 * 1.4, phase: random() * 6.28 }));
  }

  start(): void {
    this.born = performance.now();
    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      this.draw((now - this.born) / 1000);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private draw(time: number): void {
    const ctx = this.context;
    if (!ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(this.canvas.clientWidth * ratio);
    const height = Math.round(this.canvas.clientHeight * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const cx = width / 2;
    const cy = height / 2;
    const unit = Math.min(width, height);
    // The star ignites over its first second, then breathes.
    const lit = Math.min(1, time / 1.1) ** 2;
    const flicker = 0.96 + 0.04 * Math.sin(time * 7) * Math.sin(time * 3.1);
    const power = lit * flicker * (1 + this.state.flare * 2.5);

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    for (const grain of this.dust) {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.7 + grain.phase));
      ctx.fillStyle = `rgba(214, 226, 255, ${0.5 * twinkle * lit})`;
      ctx.beginPath();
      ctx.arc(grain.x * width, grain.y * height, grain.size * ratio * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const glow = (radius: number, inner: string, outer: string, squashX = 1, squashY = 1, turn = 0) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(turn);
      ctx.scale(squashX, squashY);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Halo, wide then tight.
    glow(unit * 0.44 * (0.7 + 0.3 * power), `rgba(255, 196, 140, ${0.16 * power})`, "rgba(255, 196, 140, 0)");
    glow(unit * 0.15, `rgba(255, 236, 214, ${0.55 * power})`, "rgba(255, 236, 214, 0)");
    // Four long spikes, four faint ones between them.
    for (let i = 0; i < 2; i += 1) glow(unit * 0.5 * (0.55 + 0.45 * lit), `rgba(214, 228, 255, ${0.95 * power})`, "rgba(214, 228, 255, 0)", 1, 0.011, (i * Math.PI) / 2);
    for (let i = 0; i < 2; i += 1) glow(unit * 0.2, `rgba(255, 210, 170, ${0.4 * power})`, "rgba(255, 210, 170, 0)", 1, 0.012, Math.PI / 4 + (i * Math.PI) / 2);
    // The ring a lens draws around a bright light.
    ctx.lineWidth = unit * 0.006;
    const ring = ctx.createLinearGradient(cx - unit * 0.2, cy, cx + unit * 0.2, cy);
    ring.addColorStop(0, `rgba(120, 170, 255, ${0.1 * power})`);
    ring.addColorStop(0.5, `rgba(255, 220, 180, ${0.05 * power})`);
    ring.addColorStop(1, `rgba(255, 130, 90, ${0.1 * power})`);
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, unit * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    // The core.
    glow(unit * 0.03, `rgba(255, 255, 255, ${Math.min(1, power)})`, "rgba(255, 244, 228, 0)");
    glow(unit * 0.012, "rgba(255, 255, 255, 1)", "rgba(255, 255, 255, 0.4)");

    // Progress: a thin ring with a mark every tenth.
    ctx.globalCompositeOperation = "source-over";
    const radius = unit * 0.3;
    ctx.lineWidth = Math.max(1, ratio);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * lit})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 40; i += 1) {
      const angle = (i / 40) * Math.PI * 2 - Math.PI / 2;
      const long = i % 4 === 0;
      ctx.strokeStyle = `rgba(255, 255, 255, ${(long ? 0.4 : 0.16) * lit})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (radius + unit * 0.012), cy + Math.sin(angle) * (radius + unit * 0.012));
      ctx.lineTo(cx + Math.cos(angle) * (radius + unit * (long ? 0.03 : 0.02)), cy + Math.sin(angle) * (radius + unit * (long ? 0.03 : 0.02)));
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 164, 96, 0.95)";
    ctx.lineWidth = Math.max(1.5, ratio * 1.5);
    ctx.shadowColor = "rgba(255, 150, 80, 0.9)";
    ctx.shadowBlur = 12 * ratio;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.state.progress));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
