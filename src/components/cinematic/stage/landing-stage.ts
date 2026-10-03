import { ACESFilmicToneMapping, HalfFloatType, PCFShadowMap, SRGBColorSpace, Vector2, WebGLRenderTarget, WebGLRenderer } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { createNoise } from "./noise";
import { OrbitScene } from "./orbit-scene";
import { WorldScene } from "./world-scene";

/**
 * The landing's 3D stage: one renderer, two scenes (the planet seen from
 * orbit, then the island) and the film look on top (bloom, lens, grain).
 * GSAP tweens `state`; the render loop reads it every frame.
 */

export interface StageState {
  /** Which scene is drawn. */
  phase: "orbit" | "world";
  /** 0 → 1: the slow drift towards the planet while the visitor signs in. */
  approach: number;
  /** 0 → 1: the plunge from orbit to the surface. */
  dive: number;
  /** 0 → 1: the screen burnt white by the atmosphere. */
  flash: number;
  /** 1 → 0: falling out of the clouds onto the first view of the island. */
  entry: number;
  shake: number;
  /** Where the page's scroll wants the camera on the tour. */
  tour: number;
}

/* The last pass before tone mapping: lens fringes, darker corners, film grain, the white of entry. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFlash: { value: 0 },
    uFringe: { value: 0.0035 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.055 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFlash;
    uniform float uFringe;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 shift = c * r2 * uFringe;
      vec3 col = vec3(texture2D(tDiffuse, vUv - shift).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + shift).b);
      col *= 1.0 - uVignette * smoothstep(0.1, 0.9, r2 * 1.9);
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = max(vec3(0.0), mix(vec3(luma), col, 1.08));
      float grain = fract(sin(dot(vUv * 913.0 + fract(uTime) * 17.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      col += (col + 0.02) * grain * uGrain;
      col = mix(col, vec3(1.0, 0.94, 0.86) * 5.0, uFlash);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

interface Tier {
  readonly terrain: number;
  readonly shadows: number;
  readonly samples: number;
  /** Starting share of the screen's own pixel density. */
  readonly ratio: number;
}

/** Picks a starting quality from the graphics chip; the frame rate refines it afterwards. */
function pickTier(renderer: WebGLRenderer): Tier {
  const gl = renderer.getContext();
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "").toLowerCase();
  const small = Math.min(window.innerWidth, window.innerHeight) < 600 || window.matchMedia("(pointer: coarse)").matches;
  if (small || /mali|adreno|powervr|swiftshader|llvmpipe/.test(name)) return { terrain: 320, shadows: 1024, samples: 0, ratio: 0.8 };
  if (/nvidia|geforce|rtx|gtx|radeon rx|radeon pro|arc\(tm\) a|apple m/.test(name)) return { terrain: 560, shadows: 4096, samples: 4, ratio: 1 };
  return { terrain: 480, shadows: 2048, samples: 4, ratio: (window.devicePixelRatio || 1) > 1.3 ? 0.75 : 1 };
}

/** No more pixels than a 4K screen, whatever the display claims. */
const MAX_PIXELS = 3840 * 2160;

export class LandingStage {
  readonly state: StageState = { phase: "orbit", approach: 0, dive: 0, flash: 0, entry: 0, shake: 0, tour: 0 };
  /** Called every frame in orbit with the beacon's place on screen. */
  onBeacon: ((x: number, y: number, visible: boolean) => void) | null = null;

  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly tier: Tier;
  private readonly noise = createNoise();
  private readonly orbit: OrbitScene;
  private world: WorldScene | null = null;
  private frame = 0;
  private last = 0;
  private time = 0;
  private tour = 0;
  private visible = true;
  private ratio = 1;
  private ceiling = 1;
  private span = 0;
  private frames = 0;
  private calm = 0;
  private settle = 0;
  private phase: StageState["phase"] = "orbit";
  private readonly pointer = { x: 0, y: 0, cx: 0, cy: 0 };
  private readonly onResize = () => this.resize();
  private readonly onVisibility = () => {
    this.visible = document.visibilityState === "visible";
    this.last = performance.now();
  };
  private readonly onPointer = (event: PointerEvent) => {
    this.pointer.x = event.clientX / window.innerWidth - 0.5;
    this.pointer.y = event.clientY / window.innerHeight - 0.5;
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.setClearColor(0x000000, 1);
    this.tier = pickTier(this.renderer);
    this.ratio = this.tier.ratio;

    this.orbit = new OrbitScene(this.noise.texture);
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: this.tier.samples });
    this.composer = new EffectComposer(this.renderer, target);
    this.renderPass = new RenderPass(this.orbit.scene, this.orbit.camera);
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.34, 0.7, 0.95);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
  }

  /** Where the landmark of the current stop is on screen, for the line from its panel. */
  get anchor(): { readonly x: number; readonly y: number; readonly visible: boolean } | null {
    return this.state.phase === "world" && this.world ? this.world.anchor : null;
  }

  /** The hour on the island, 0 (dawn) to 1 (night), at the camera's current place. */
  get sol(): number {
    return this.world?.rail.sol(this.tour) ?? 0;
  }

  /** How many stops the tour has, minus one: the highest value `state.tour` can take. */
  get lastStop(): number {
    return this.world?.rail.last ?? 0;
  }

  /** Downloads the planet and builds the island; `onProgress` receives 0 → 1. */
  async load(onProgress: (value: number) => void): Promise<void> {
    let planet = 0;
    let island = 0;
    const report = () => onProgress(planet * 0.45 + island * 0.55);
    const planetReady = this.orbit.load((value) => {
      planet = value;
      report();
    }, this.renderer.capabilities.getMaxAnisotropy());
    this.world = await WorldScene.build({ terrain: this.tier.terrain, shadows: this.tier.shadows }, this.noise, (value) => {
      island = value * 0.9;
      report();
    });
    this.resize();
    await planetReady;
    // Compile every shader now, so neither scene stutters on its first frame.
    this.renderer.compile(this.orbit.scene, this.orbit.camera);
    this.world.update({ tour: 0, entry: 0, shake: 0, pointerX: 0, pointerY: 0 }, 0, 0.016);
    await this.renderer.compileAsync(this.world.scene, this.world.camera);
    island = 1;
    report();
  }

  start(): void {
    if (this.frame) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      const elapsed = now - this.last;
      this.last = now;
      if (!this.visible) return;
      this.render(Math.min(0.05, elapsed / 1000));
      this.adapt(elapsed);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private render(dt: number): void {
    const { state, pointer } = this;
    this.time += dt;
    pointer.cx += (pointer.x - pointer.cx) * Math.min(1, dt * 3);
    pointer.cy += (pointer.y - pointer.cy) * Math.min(1, dt * 3);
    const uniforms = this.grade.uniforms;
    (uniforms.uTime as { value: number }).value = this.time;
    (uniforms.uFlash as { value: number }).value = state.flash;
    (uniforms.uFringe as { value: number }).value = 0.0035 + state.shake * 0.03 + state.dive * 0.05 + state.entry * 0.03;

    if (state.phase !== this.phase) {
      // The first frames of a scene are slow for their own reasons; they say nothing about the device.
      this.phase = state.phase;
      this.settle = 90;
    }
    if (state.phase === "world" && this.world) {
      // The camera follows the scroll with a little inertia.
      this.tour += (state.tour - this.tour) * (1 - Math.exp(-dt * 3.6));
      this.world.update({ tour: this.tour, entry: state.entry, shake: state.shake, pointerX: pointer.cx, pointerY: pointer.cy }, this.time, dt);
      this.renderPass.scene = this.world.scene;
      this.renderPass.camera = this.world.camera;
      this.renderer.toneMappingExposure = this.world.atmosphere.exposure;
      this.bloom.strength = 0.3 + this.world.atmosphere.lights * 0.3;
    } else {
      this.orbit.update({ approach: state.approach, dive: state.dive, shake: state.shake, pointerX: pointer.cx, pointerY: pointer.cy }, this.time, dt);
      this.renderPass.scene = this.orbit.scene;
      this.renderPass.camera = this.orbit.camera;
      this.renderer.toneMappingExposure = 1;
      this.bloom.strength = 0.55;
      this.onBeacon?.(this.orbit.beacon.x, this.orbit.beacon.y, this.orbit.beacon.visible);
    }
    this.composer.render(dt);
  }

  /** Lowers the drawing resolution when frames are slow, and raises it again when there is room. */
  private adapt(elapsed: number): void {
    if (this.settle > 0) {
      this.settle -= 1;
      return;
    }
    this.span += elapsed;
    this.frames += 1;
    if (this.frames < 90) return;
    const average = this.span / this.frames;
    this.span = 0;
    this.frames = 0;
    if (average > 23 && this.ratio > 0.55) {
      // Remember that this resolution was too much, so it is not tried again right away.
      this.ceiling = Math.max(0.55, this.ratio * 0.96);
      this.ratio = Math.max(0.55, this.ratio * 0.85);
      this.calm = 0;
      this.applySize();
    } else if (average < 17.6 && this.ratio < this.ceiling) {
      this.calm += 1;
      if (this.calm < 3) return;
      this.calm = 0;
      this.ratio = Math.min(this.ceiling, this.ratio * 1.1);
      this.applySize();
    } else {
      this.calm = 0;
    }
  }

  private resize(): void {
    this.applySize();
  }

  private applySize(): void {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const density = Math.min(window.devicePixelRatio || 1, 2) * this.ratio;
    const capped = Math.min(density, Math.sqrt(MAX_PIXELS / (width * height)));
    this.renderer.setPixelRatio(capped);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(capped);
    this.composer.setSize(width, height);
    this.orbit.resize(width, height);
    this.orbit.setDrawHeight(height * capped);
    this.world?.resize(width, height);
    this.world?.setDrawHeight(height * capped);
    // A resize costs a few slow frames of its own: do not count them.
    this.settle = 30;
    this.span = 0;
    this.frames = 0;
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pointermove", this.onPointer);
    this.onBeacon = null;
    this.orbit.dispose();
    this.world?.dispose();
    this.noise.texture.dispose();
    this.bloom.dispose();
    this.grade.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
