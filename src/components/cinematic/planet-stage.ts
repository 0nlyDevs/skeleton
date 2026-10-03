import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BackSide,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  type MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { atmosphereFragment, atmosphereVertex, patchMaterial, rimFragment, type DissolveUniforms } from "./planet-shaders";

/**
 * The hero's 3D stage: Earth, then Nova, lit by one low sun so a deep night
 * side always crosses the globe.
 *
 * Every animatable value lives in `state`; GSAP tweens those numbers and the
 * render loop reads them, so the timeline and the scroll scrub never touch
 * three.js objects directly.
 */

export interface StageState {
  /** 0 = hidden, 1 = presented (fades and drifts in). */
  rise: number;
  /** Entrance path: 0 = huge, off to the left; 1 = horizon under the title. */
  sink: number;
  /** Camera sweep for the entrance: 0 = high, wide and to the side, 1 = front. */
  orbit: number;
  /** 0 = Earth, 1 = Nova. */
  morph: number;
  /** Radians per second of spin. */
  spin: number;
  /** Scroll layout, tweened by ScrollTrigger. */
  x: number;
  y: number;
  scale: number;
  tilt: number;
  /** Global fade for the end of the page. */
  opacity: number;
}

/** Where the planet's top edge sits in the hero, as a fraction of the screen height. */
export const HORIZON_LANDSCAPE = 0.48;
export const HORIZON_PORTRAIT = 0.56;

const EARTH_URL = "/models/earth.glb";
const NOVA_URL = "/models/nova.glb";
const EARTH_SIZE = 3_362_532;
const NOVA_SIZE = 2_873_024;

function normalise(root: Object3D): void {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z);
  root.position.sub(center.multiplyScalar(scale));
  root.scale.setScalar(scale);
}

/** Each material once, even when several meshes share it (the Earth's halves do). */
function materialsOf(root: Object3D): Material[] {
  const set = new Set<Material>();
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) set.add(material);
  });
  return [...set];
}

function glowMaterial(fragmentShader: string, side: typeof BackSide | undefined, sunView: { value: Vector3 }, color: Color) {
  return new ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader,
    uniforms: { uColor: { value: color }, uSunView: sunView, uIntensity: { value: 1 } },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    ...(side ? { side } : {}),
  });
}

export class PlanetStage {
  readonly state: StageState = { rise: 0, sink: 0, orbit: 1, morph: 0, spin: 0.12, x: 0, y: 0, scale: 1, tilt: 0, opacity: 1 };

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 100);
  private readonly pivot = new Group();
  private readonly spinner = new Group();
  private readonly sun = new DirectionalLight("#fff4e6", 2.6);
  private readonly sunView = { value: new Vector3() };
  private readonly dissolve: DissolveUniforms = { uDissolve: { value: 0 }, uEdgeColor: { value: new Color("#ffd2a8") } };
  private readonly atmosphereColor = new Color("#5fb8ff");
  private readonly earthColor = new Color("#5fb8ff");
  private readonly novaColor = new Color("#ffb08a");
  private readonly glows: ShaderMaterial[] = [];
  private earth: Object3D | null = null;
  private nova: Object3D | null = null;
  private clouds: Object3D | null = null;
  private frame = 0;
  private last = 0;
  private visible = true;
  private pointer = { x: 0, y: 0, cx: 0, cy: 0 };
  private readonly onResize = () => this.resize();
  private readonly onVisibility = () => {
    this.visible = document.visibilityState === "visible";
  };
  private readonly onPointer = (event: PointerEvent) => {
    this.pointer.x = event.clientX / window.innerWidth - 0.5;
    this.pointer.y = event.clientY / window.innerHeight - 0.5;
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.setClearColor(0x000000, 0);

    this.camera.position.set(0, 0, 9);
    // A low sun from the upper left and slightly behind: a wide crescent of day, a deep night.
    this.sun.position.set(-4.5, 3.2, 3.2);
    this.scene.add(this.sun, new AmbientLight("#1b2a4a", 0.12));
    const rim = new DirectionalLight("#3b6dff", 0.6);
    rim.position.set(5, -2, -4);
    this.scene.add(rim);

    this.pivot.add(this.spinner);
    this.scene.add(this.pivot);

    const sphere = new SphereGeometry(1, 96, 96);
    const halo = new Mesh(sphere, glowMaterial(atmosphereFragment, BackSide, this.sunView, this.atmosphereColor));
    halo.scale.setScalar(1.045);
    const rimGlow = new Mesh(sphere, glowMaterial(rimFragment, undefined, this.sunView, this.atmosphereColor));
    rimGlow.scale.setScalar(1.004);
    this.glows.push(halo.material, rimGlow.material);
    this.pivot.add(halo, rimGlow);

    this.resize();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
  }

  /** Downloads both planets; `onProgress` receives 0 → 1 from real bytes. */
  async load(onProgress: (value: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const loaded = { earth: 0, nova: 0 };
    const report = () => onProgress(Math.min(1, (loaded.earth + loaded.nova) / (EARTH_SIZE + NOVA_SIZE)));
    const [earth, nova] = await Promise.all([
      loader.loadAsync(EARTH_URL, (event) => {
        loaded.earth = event.loaded;
        report();
      }),
      loader.loadAsync(NOVA_URL, (event) => {
        loaded.nova = event.loaded;
        report();
      }),
    ]);
    onProgress(1);

    this.earth = earth.scene;
    this.earth.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as MeshStandardMaterial;
      // The model's own atmosphere is a flat, opaque shell: replaced by the halo shader.
      if (material.name === "lambert7") mesh.visible = false;
      if (material.name === "lambert6") {
        this.clouds = mesh;
        material.depthWrite = false;
        material.opacity = 0.85;
      }
      if (material.name === "phong1") {
        material.emissive = new Color("#ffd29a");
        material.roughness = 0.85;
        material.metalness = 0;
      }
    });
    normalise(this.earth);
    // Sharp texture detail even near the limb, where the globe is seen at a grazing angle.
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    for (const material of [...materialsOf(this.earth), ...materialsOf(nova.scene)]) {
      for (const value of Object.values(material)) {
        if (value && typeof value === "object" && "isTexture" in value) (value as { anisotropy: number }).anisotropy = anisotropy;
      }
    }
    for (const material of materialsOf(this.earth)) {
      patchMaterial(material, { dissolve: this.dissolve, nightLights: material.name === "phong1" ? { uSunView: this.sunView } : undefined });
    }

    this.nova = nova.scene;
    normalise(this.nova);
    for (const material of materialsOf(this.nova)) patchMaterial(material, { dissolve: this.dissolve, invert: true });
    this.nova.visible = false;

    this.earth.rotation.z = 0.41; // Earth's axial tilt.
    this.spinner.add(this.earth, this.nova);
    // Compile now, so the first animated frame does not stutter.
    this.renderer.compile(this.scene, this.camera);
  }

  start(): void {
    if (this.frame) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.visible && this.state.opacity > 0.01 && this.state.rise > 0.001) this.render(dt);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private render(dt: number): void {
    const s = this.state;
    this.spinner.rotation.y += dt * s.spin;
    if (this.clouds) this.clouds.rotation.y += dt * 0.012;

    this.dissolve.uDissolve.value = s.morph;
    if (this.earth) this.earth.visible = s.morph < 0.999;
    if (this.nova) this.nova.visible = s.morph > 0.001;
    this.atmosphereColor.copy(this.earthColor).lerp(this.novaColor, s.morph);
    for (const glow of this.glows) glow.uniforms.uIntensity.value = 0.28 * s.opacity * (1 - 0.35 * Math.sin(Math.PI * s.morph));

    // One continuous arc: from huge and half off-screen on the left to a giant
    // horizon whose top hides the bottom of the title (HORIZON_* below).
    const portrait = this.camera.aspect < 0.9;
    const halfHeight = this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360);
    const halfWidth = halfHeight * this.camera.aspect;
    const heroScale = portrait ? 2.2 : 3.9;
    const horizon = portrait ? HORIZON_PORTRAIT : HORIZON_LANDSCAPE;
    const heroY = halfHeight * (1 - 2 * horizon) - heroScale;
    const start = { x: -halfWidth * 1.05, y: halfHeight * 0.15, scale: heroScale * 1.25 };
    const k = s.sink;
    const xSpread = Math.min(1, this.camera.aspect * 0.75);
    const scale = (start.scale + (heroScale - start.scale) * k) * (1 + (s.scale - 1) * k) * (0.92 + 0.08 * s.rise);
    const x = start.x * (1 - k) + s.x * xSpread * k;
    const y = start.y + (heroY - start.y) * k + Math.sin(Math.PI * k) * halfHeight * 0.18 + s.y * k;
    this.pivot.position.set(x, y, 0);
    this.pivot.scale.setScalar(scale);
    this.pivot.rotation.z = s.tilt;

    this.pointer.cx += (this.pointer.x - this.pointer.cx) * 0.04;
    this.pointer.cy += (this.pointer.y - this.pointer.cy) * 0.04;
    // Entrance: the camera swings round the globe from above and to the side,
    // dollying in, and banks back to level as it settles in front.
    const sweep = 1 - s.orbit;
    const yaw = -0.45 * sweep;
    const pitch = 0.18 * sweep;
    const distance = 9 + 2.5 * sweep;
    this.camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * distance + this.pointer.cx * 0.35,
      Math.sin(pitch) * distance - this.pointer.cy * 0.25,
      Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.rotateZ(0.08 * sweep);
    this.camera.updateMatrixWorld();

    this.sunView.value.copy(this.sun.position).normalize().transformDirection(this.camera.matrixWorldInverse);
    this.canvas.style.opacity = String(s.opacity * Math.min(1, s.rise * 1.4));
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const { innerWidth: width, innerHeight: height } = window;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pointermove", this.onPointer);
    this.scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const value of Object.values(material)) {
          if (value && typeof value === "object" && "isTexture" in value) (value as { dispose: () => void }).dispose();
        }
        material.dispose();
      }
    });
    this.renderer.dispose();
  }
}
