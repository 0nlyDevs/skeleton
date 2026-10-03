/**
 * The landing's sound, made on the spot with the Web Audio API: no file to
 * download. Three beds (space, the island, the city hall) and short cues for
 * what happens on screen. A browser only lets a page play sound after the
 * visitor has clicked or pressed a key, so `unlock` is called on that first
 * gesture; the choice to mute is kept between visits.
 */

export type SoundBed = "space" | "island" | "hall";
export type SoundCue = "ignite" | "lock" | "warp" | "entry" | "arrive" | "stop" | "panel" | "hover" | "click" | "open" | "close" | "error" | "success" | "stamp" | "tick";

const PREFERENCE_KEY = "tn-sound";
/** A pentatonic scale: any two stops sound right together. */
const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private bed: { kind: SoundBed; gain: GainNode; nodes: AudioScheduledSourceNode[] } | null = null;
  private wanted: SoundBed | null = null;
  private on = true;
  private lastHover = 0;

  constructor() {
    try {
      this.on = window.localStorage.getItem(PREFERENCE_KEY) !== "off";
    } catch {
      // Private mode: sound stays on for this visit.
    }
  }

  get enabled(): boolean {
    return this.on;
  }

  /** True once the browser has let the page play. */
  get live(): boolean {
    return this.context?.state === "running";
  }

  /** Call from a click or a key press: starts the audio if the visitor wants it. */
  unlock(): void {
    if (!this.on) return;
    if (!this.context) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.ratio.value = 6;
      this.master = this.context.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(limiter).connect(this.context.destination);
      const length = this.context.sampleRate * 2;
      this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    void this.context.resume().then(() => {
      if (this.wanted && this.bed?.kind !== this.wanted) this.ambience(this.wanted);
    });
  }

  setEnabled(on: boolean): void {
    this.on = on;
    try {
      window.localStorage.setItem(PREFERENCE_KEY, on ? "on" : "off");
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
    if (on) this.unlock();
    else if (this.context && this.master) this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
    if (on && this.context && this.master) this.master.gain.setTargetAtTime(0.9, this.context.currentTime, 0.2);
  }

  /** Pauses with the page (tab hidden), resumes with it. */
  setPaused(paused: boolean): void {
    if (!this.context || !this.on) return;
    if (paused) void this.context.suspend();
    else void this.context.resume();
  }

  private source(): AudioBufferSourceNode | null {
    if (!this.context || !this.noise) return null;
    const node = this.context.createBufferSource();
    node.buffer = this.noise;
    node.loop = true;
    return node;
  }

  /** The continuous sound of a place; it fades into the next one. */
  ambience(kind: SoundBed | null): void {
    this.wanted = kind;
    const ctx = this.context;
    if (!ctx || !this.master || !this.live) return;
    const now = ctx.currentTime;
    if (this.bed) {
      if (this.bed.kind === kind) return;
      const old = this.bed;
      old.gain.gain.setTargetAtTime(0, now, 0.6);
      for (const node of old.nodes) node.stop(now + 3);
      this.bed = null;
    }
    if (!kind) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const nodes: AudioScheduledSourceNode[] = [];
    const tone = (frequency: number, level: number, type: OscillatorType = "sine") => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      amp.gain.value = level;
      osc.connect(amp).connect(gain);
      osc.start();
      nodes.push(osc);
      return amp;
    };
    const wash = (filterType: BiquadFilterType, frequency: number, q: number, level: number, sway: number, swayRate: number) => {
      const src = this.source();
      if (!src) return;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const amp = ctx.createGain();
      amp.gain.value = level;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = swayRate;
      depth.gain.value = sway;
      lfo.connect(depth).connect(amp.gain);
      src.connect(filter).connect(amp).connect(gain);
      src.start();
      lfo.start();
      nodes.push(src, lfo);
    };
    if (kind === "space") {
      // A deep hum, two notes slowly beating against each other.
      tone(55, 0.5);
      tone(55.6, 0.4);
      tone(82.4, 0.16);
      wash("lowpass", 320, 0.4, 0.05, 0.03, 0.07);
      gain.gain.setTargetAtTime(0.16, now, 1.2);
    } else if (kind === "island") {
      // Wind, and the sea coming and going.
      wash("bandpass", 620, 0.5, 0.16, 0.08, 0.11);
      wash("lowpass", 420, 0.3, 0.2, 0.16, 0.09);
      wash("highpass", 5200, 0.2, 0.012, 0.008, 0.31);
      gain.gain.setTargetAtTime(0.2, now, 1.5);
    } else {
      // A warm chord under a vault.
      for (const [frequency, level] of [[220, 0.2], [261.63, 0.14], [329.63, 0.13], [493.88, 0.07]] as const) tone(frequency, level, "triangle");
      wash("lowpass", 500, 0.3, 0.05, 0.02, 0.1);
      gain.gain.setTargetAtTime(0.1, now, 1.2);
    }
    this.bed = { kind, gain, nodes };
  }

  private blip(frequency: number, duration: number, level: number, type: OscillatorType = "sine", glide = frequency, delay = 0): void {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), start + duration);
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(level, start + Math.min(0.02, duration * 0.3));
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private sweep(from: number, to: number, duration: number, level: number, type: BiquadFilterType = "bandpass", q = 1.2, delay = 0): void {
    const ctx = this.context;
    const src = this.source();
    if (!ctx || !this.master || !src) return;
    const start = ctx.currentTime + delay;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(level, start + duration * 0.6);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(start);
    src.stop(start + duration + 0.1);
  }

  /** A short sound for something that just happened; `detail` picks the note of a stop. */
  cue(name: SoundCue, detail = 0): void {
    if (!this.on || !this.live) return;
    switch (name) {
      case "ignite":
        this.blip(110, 2.2, 0.16, "sine", 440);
        this.sweep(2400, 7000, 2, 0.03, "bandpass", 3);
        break;
      case "lock":
        this.blip(880, 0.09, 0.07, "square");
        this.blip(1320, 0.12, 0.07, "square", 1320, 0.12);
        break;
      case "warp":
        this.sweep(160, 5200, 2.9, 0.34, "bandpass", 0.9);
        this.blip(38, 3, 0.4, "sine", 110);
        this.blip(70, 1.1, 0.5, "sine", 28, 2.75);
        break;
      case "entry":
        this.sweep(90, 260, 3.4, 0.5, "lowpass", 0.5);
        this.sweep(900, 300, 3.2, 0.1, "bandpass", 0.6, 0.4);
        break;
      case "arrive":
        for (const [i, frequency] of [523.25, 659.25, 783.99, 987.77].entries()) this.blip(frequency, 2.6, 0.06, "sine", frequency, i * 0.09);
        break;
      case "stop":
        this.sweep(1900, 280, 0.6, 0.08, "bandpass", 0.8);
        this.blip(SCALE[detail % SCALE.length] ?? 440, 1.3, 0.07, "sine", SCALE[detail % SCALE.length] ?? 440, 0.12);
        this.blip((SCALE[detail % SCALE.length] ?? 440) * 2, 0.9, 0.025, "sine", (SCALE[detail % SCALE.length] ?? 440) * 2, 0.16);
        break;
      case "panel":
        this.blip(1318.5, 0.5, 0.035);
        this.blip(1975.5, 0.4, 0.02, "sine", 1975.5, 0.05);
        break;
      case "hover": {
        const now = performance.now();
        if (now - this.lastHover < 70) return;
        this.lastHover = now;
        this.blip(2200, 0.045, 0.018);
        break;
      }
      case "click":
        this.blip(660, 0.07, 0.06, "triangle", 990);
        break;
      case "open":
        this.sweep(300, 2600, 0.9, 0.1, "bandpass", 1);
        this.blip(261.63, 1.6, 0.06, "triangle", 261.63, 0.25);
        this.blip(392, 1.6, 0.05, "triangle", 392, 0.33);
        break;
      case "close":
        this.sweep(2400, 260, 0.6, 0.08, "bandpass", 1);
        break;
      case "error":
        this.blip(150, 0.2, 0.09, "square", 120);
        this.blip(120, 0.25, 0.09, "square", 95, 0.16);
        break;
      case "success":
        for (const [i, frequency] of [523.25, 659.25, 783.99, 1046.5].entries()) this.blip(frequency, 0.9, 0.07, "triangle", frequency, i * 0.1);
        break;
      case "stamp":
        this.blip(120, 0.25, 0.4, "sine", 45);
        this.sweep(1200, 400, 0.14, 0.12, "bandpass", 0.7);
        break;
      case "tick":
        this.blip(1500, 0.02, 0.02);
        break;
    }
  }

  dispose(): void {
    this.bed = null;
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
