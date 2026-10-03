import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  atmosphereFragment,
  atmosphereVertex,
  patchMaterial,
  rimFragment,
  type DissolveUniforms,
} from "@/components/cinematic/planet-shaders";

export interface SceneState {
  mirror: number; // 0 = composition for the right-hand stage, 1 = mirrored (left-hand)
  rocketSign: number; // 1 or -1
  rocketOut: number; // >0 flies forward off screen, <0 waits behind the tail
  warp: number; // 0..1 hyperspace intensity
  pulse: number; // 0..1 shockwave ring progress
  intro: number;
}

const D = 12;
const BASE_FOV = 35;
const EARTH_URL = "/models/earth.glb";
const NOVA_URL = "/models/nova.glb";

function noiseCanvas(base: string, seed: number, size = 512): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const w = c.width;
  const h = c.height;
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 14 + rnd() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const light = rnd() > 0.5;
    grd.addColorStop(0, light ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)";
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  return c;
}

function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function flameTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const hw = (1 - t * 0.85) * (w / 2) * 0.9 + 1;
    for (let x = 0; x < w; x++) {
      const d = (x - w / 2) / hw;
      const a = Math.exp(-d * d * 2.2) * Math.pow(1 - t, 1.6);
      const i = (y * w + x) * 4;
      img.data[i] = 190 + 60 * (1 - t);
      img.data[i + 1] = 240;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

function haloTexture(rgb: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(${rgb},0.55)`);
  grd.addColorStop(0.4, `rgba(${rgb},0.14)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildRocket(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.42, metalness: 0.15 });
  const tealM = new THREE.MeshStandardMaterial({
    color: 0x78d0d6,
    roughness: 0.32,
    metalness: 0.2,
    emissive: 0x0a3b44,
    emissiveIntensity: 0.35,
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0xdfe7ec, roughness: 0.25, metalness: 0.6 });
  const P = THREE.Vector2;

  const body = new THREE.Mesh(
    new THREE.LatheGeometry(
      [new P(0, -0.52), new P(0.1, -0.5), new P(0.15, -0.45), new P(0.19, -0.3), new P(0.2, -0.05), new P(0.19, 0.12)],
      48,
    ),
    white,
  );
  const nose = new THREE.Mesh(
    new THREE.LatheGeometry([new P(0.19, 0.12), new P(0.17, 0.25), new P(0.12, 0.4), new P(0.06, 0.52), new P(0, 0.58)], 48),
    tealM,
  );
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 0.07, 32),
    new THREE.MeshStandardMaterial({ color: 0x5b6d79, roughness: 0.5, metalness: 0.5 }),
  );
  nozzle.position.y = -0.53;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 12, 48), tealM);
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.22;
  const win = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 16, 40), metal);
  win.position.set(0, 0.1, 0.195);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.075, 32),
    new THREE.MeshStandardMaterial({
      color: 0xa6e3ea,
      emissive: 0x2a8ea0,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.3,
    }),
  );
  glass.position.set(0, 0.1, 0.196);
  g.add(body, nose, nozzle, band, win, glass);

  const fin = new THREE.Shape();
  fin.moveTo(0, 0.12);
  fin.bezierCurveTo(0.12, 0.05, 0.26, -0.12, 0.31, -0.36);
  fin.lineTo(0.1, -0.31);
  fin.lineTo(0, -0.26);
  fin.lineTo(0, 0.12);
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: false });
  fg.translate(0, 0, -0.015);
  [0, Math.PI, Math.PI / 2, -Math.PI / 2].forEach((a) => {
    const holder = new THREE.Group();
    const m = new THREE.Mesh(fg, white);
    m.position.x = 0.17;
    holder.add(m);
    holder.rotation.y = a;
    g.add(holder);
  });

  const ft = flameTexture();
  const fgGeo = new THREE.PlaneGeometry(0.34, 2.4);
  fgGeo.translate(0, -1.2, 0);
  const flame = new THREE.Mesh(
    fgGeo,
    new THREE.MeshBasicMaterial({ map: ft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }),
  );
  flame.position.y = -0.56;
  const coreGeo = new THREE.PlaneGeometry(0.14, 1.1);
  coreGeo.translate(0, -0.55, 0);
  const core = new THREE.Mesh(
    coreGeo,
    new THREE.MeshBasicMaterial({ map: ft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 }),
  );
  core.position.y = -0.56;
  g.add(flame, core);
  g.userData.flame = flame;
  g.userData.core = core;
  return g;
}

function normalise(root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z);
  root.position.sub(center.multiplyScalar(scale));
  root.scale.setScalar(scale);
}

function glowMaterial(
  fragmentShader: string,
  side: typeof THREE.BackSide | undefined,
  sunView: { value: THREE.Vector3 },
  color: THREE.Color,
) {
  return new THREE.ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader,
    uniforms: { uColor: { value: color }, uSunView: sunView, uIntensity: { value: 0.85 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    ...(side ? { side } : {}),
  });
}

export class FuturisticAuthScene {
  readonly state: SceneState = {
    mirror: 0,
    rocketSign: 1,
    rocketOut: 0,
    warp: 0,
    pulse: 0,
    intro: 0,
  };

  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 120);
  private animFrame = 0;
  private running = true;
  private clock = new THREE.Clock();

  private px = 0;
  private py = 0;
  private tx = 0;
  private ty = 0;
  private halfH = 1;
  private halfW = 1;

  private sunView = { value: new THREE.Vector3() };
  private dissolve: DissolveUniforms = {
    uDissolve: { value: 0 },
    uEdgeColor: { value: new THREE.Color("#ffd2a8") },
  };

  private keyLight = new THREE.DirectionalLight(0x8fe8df, 1.9);
  private rocket: THREE.Group | null = null;
  private bigPlanetGroup = new THREE.Group();
  private realEarthMesh: THREE.Object3D | null = null;
  private realNovaMesh: THREE.Object3D | null = null;
  private cloudsMesh: THREE.Mesh | null = null;
  private stars: THREE.Points | null = null;
  private streaks: THREE.LineSegments | null = null;
  private stGeo: THREE.BufferGeometry | null = null;
  private stMat: THREE.LineBasicMaterial | null = null;
  private wave: THREE.Mesh | null = null;
  private items: Array<{
    o: THREE.Object3D;
    nx: number;
    ny: number;
    z: number;
    r: number;
    par: number;
    mx: number;
    my: number;
    mr: number;
  }> = [];

  private sx: number[] = [];
  private sy: number[] = [];
  private sz: number[] = [];
  private sPos: Float32Array = new Float32Array(420 * 6);

  private readonly onPointerMove = (e: PointerEvent) => {
    this.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    this.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  private readonly onVisibilityChange = () => {
    this.running = document.visibilityState === "visible";
    this.clock.getDelta();
  };

  private readonly onResize = () => this.resize();
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly isMobile: () => boolean) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.setClearColor(0x000000, 0);
    } catch {
      return;
    }

    this.camera.position.set(0, 0, D);
    this.scene.add(new THREE.AmbientLight(0x6fa3c4, 0.5));
    this.scene.add(this.keyLight);
    const fill = new THREE.DirectionalLight(0x2a6fa0, 0.5);
    fill.position.set(-4, -2, 3);
    this.scene.add(fill);

    this.initScene();
    this.resize();

    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    if (window.ResizeObserver && canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", this.onResize);
    }

    void this.loadLandingPageModels();
  }

  private initScene(): void {
    const sphere = new THREE.SphereGeometry(1, 64, 48);
    const planetMat = (color: number, seed: number, rough?: number) => {
      return new THREE.MeshStandardMaterial({
        color,
        roughness: rough ?? 0.95,
        metalness: 0.02,
        map: tex(noiseCanvas("#dcdcdc", seed)),
        bumpMap: tex(noiseCanvas("#808080", seed + 5)),
        bumpScale: 1.2,
      });
    };

    const addItem = (
      obj: THREE.Object3D,
      nx: number,
      ny: number,
      z: number,
      r: number,
      par: number,
      mx: number,
      my: number,
      mr: number,
    ) => {
      this.items.push({ o: obj, nx, ny, z, r, par, mx, my, mr });
      this.scene.add(obj);
      return obj;
    };

    // Big Globe group: procedural baseline, then replaced/blended with landing page Earth/Nova GLB
    const initialGlobe = new THREE.Mesh(sphere, planetMat(0x2f8d96, 11));
    initialGlobe.name = "proceduralGlobe";
    this.bigPlanetGroup.add(initialGlobe);

    const atmosphereColor = new THREE.Color("#5fb8ff");
    const halo = new THREE.Mesh(sphere, glowMaterial(atmosphereFragment, THREE.BackSide, this.sunView, atmosphereColor));
    halo.scale.setScalar(1.045);
    const rimGlow = new THREE.Mesh(sphere, glowMaterial(rimFragment, undefined, this.sunView, atmosphereColor));
    rimGlow.scale.setScalar(1.004);
    this.bigPlanetGroup.add(halo, rimGlow);

    addItem(this.bigPlanetGroup, 0.97, -1.43, -2, 1.48, 0.012, 0.8, -1.5, 1.35);

    // Dome planet
    const dome = new THREE.Mesh(sphere, planetMat(0x0e3d58, 23, 1));
    addItem(dome, -0.55, -1.2, -3, 0.85, 0.02, -0.9, -1.45, 0.9);

    // Ringed planet (Saturn-like)
    const ringPlanet = new THREE.Group();
    ringPlanet.add(new THREE.Mesh(sphere, planetMat(0x2c7894, 37)));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.18, 1.52, 128),
      new THREE.MeshBasicMaterial({ color: 0x07202f, side: THREE.DoubleSide }),
    );
    ring.rotation.x = 1.36;
    ring.rotation.y = 0.0;
    ring.rotation.z = 0.06;
    ringPlanet.add(ring);
    addItem(ringPlanet, 0.38, 0.34, -2, 0.21, 0.03, 0.5, 0.18, 0.27);

    // Moon with luminous halo
    const moon = new THREE.Group();
    moon.add(new THREE.Mesh(sphere, planetMat(0xcdbb8c, 41, 1)));
    const haloSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture("222,205,150"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    haloSprite.scale.setScalar(4.4);
    moon.add(haloSprite);
    addItem(moon, 0.84, 0.68, -4, 0.075, 0.018, 0.9, 0.62, 0.1);

    // Rocket
    this.rocket = buildRocket();
    this.scene.add(this.rocket);

    // Static stars
    const sp: number[] = [];
    for (let i = 0; i < 380; i++) {
      sp.push((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, -10 - Math.random() * 12);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xcfeeff, size: 0.07, transparent: true, opacity: 0.75, depthWrite: false }),
    );
    this.scene.add(this.stars);

    // Warp speed streaks
    const N = 420;
    this.sPos = new Float32Array(N * 6);
    this.sx = [];
    this.sy = [];
    this.sz = [];
    const seedStreak = (k: number, first: boolean) => {
      const a = Math.random() * Math.PI * 2;
      const rr = 1.2 + Math.random() * 14;
      this.sx[k] = Math.cos(a) * rr;
      this.sy[k] = Math.sin(a) * rr;
      this.sz[k] = first ? -60 + Math.random() * 66 : -60;
    };
    for (let i = 0; i < N; i++) seedStreak(i, true);

    this.stGeo = new THREE.BufferGeometry();
    this.stGeo.setAttribute("position", new THREE.BufferAttribute(this.sPos, 3));
    this.stMat = new THREE.LineBasicMaterial({
      color: 0x9fe9ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.streaks = new THREE.LineSegments(this.stGeo, this.stMat);
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);

    // Shockwave ring
    this.wave = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 128),
      new THREE.MeshBasicMaterial({
        color: 0x8fe8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.wave.position.z = 1;
    this.scene.add(this.wave);
  }

  private async loadLandingPageModels(): Promise<void> {
    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const [earthGltf, novaGltf] = await Promise.all([
        loader.loadAsync(EARTH_URL),
        loader.loadAsync(NOVA_URL),
      ]);

      const earth = earthGltf.scene;
      earth.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.name === "lambert7") mesh.visible = false;
        if (mat.name === "lambert6") {
          this.cloudsMesh = mesh;
          mat.depthWrite = false;
          mat.opacity = 0.85;
        }
        if (mat.name === "phong1") {
          mat.emissive = new THREE.Color("#ffd29a");
          mat.roughness = 0.85;
          mat.metalness = 0;
        }
      });
      normalise(earth);

      const nova = novaGltf.scene;
      normalise(nova);

      for (const node of [earth, nova]) {
        node.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh && m.material) {
            patchMaterial(Array.isArray(m.material) ? m.material[0] : m.material, {
              dissolve: this.dissolve,
              nightLights: { uSunView: this.sunView },
            });
          }
        });
      }

      earth.rotation.z = 0.41;
      this.realEarthMesh = earth;
      this.realNovaMesh = nova;
      nova.visible = false;

      // Swap out the procedural sphere
      const procedural = this.bigPlanetGroup.getObjectByName("proceduralGlobe");
      if (procedural) {
        this.bigPlanetGroup.remove(procedural);
      }
      this.bigPlanetGroup.add(earth, nova);
    } catch {
      // Keep procedural planet fallback if GLB models fail to load
    }
  }

  start(): void {
    if (this.animFrame) return;
    this.clock.start();
    const loop = () => {
      this.animFrame = requestAnimationFrame(loop);
      if (!this.running || !this.renderer) return;
      this.render();
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  private render(): void {
    if (!this.renderer) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const mob = this.isMobile();
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduce) {
      this.px += (this.tx - this.px) * 0.05;
      this.py += (this.ty - this.py) * 0.05;
    }

    const s = 1 - 2 * this.state.mirror;
    this.camera.fov = BASE_FOV + this.state.warp * 42;
    this.camera.updateProjectionMatrix();
    this.keyLight.position.set(4 * s, 4, 5);

    // Update items
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const k = (D - it.z) / D;
      const nx = mob ? it.mx : it.nx;
      const ny = mob ? it.my : it.ny;
      const r = mob ? it.mr : it.r;
      it.o.position.set(
        nx * s * this.halfW * k + this.px * it.par * this.halfH * 6 * k,
        ny * this.halfH * k - this.py * it.par * this.halfH * 6 * k,
        it.z,
      );
      it.o.scale.setScalar(r * this.halfH * k * (1 + this.state.warp * 0.05));
      it.o.rotation.y += dt * 0.03;
    }

    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += dt * 0.012;
    }

    // Rocket animation
    if (this.rocket) {
      const rocketAnchor = { nx: -0.62, ny: 0.26, mx: -0.6, my: 0.04, len: 0.24, mlen: 0.5 };
      const a = mob ? { nx: rocketAnchor.mx, ny: rocketAnchor.my, len: rocketAnchor.mlen } : rocketAnchor;
      const rs = this.state.rocketSign;
      const ROT = 0.9;
      const ang = ROT * rs;
      const dx = -Math.sin(ang);
      const dy = Math.cos(ang);
      const L = 2.6 * Math.max(this.halfW, this.halfH);
      const bob = reduce ? 0 : Math.sin(t * 1.3) * 0.02 * this.halfH;

      this.rocket.position.set(
        a.nx * rs * this.halfW + dx * this.state.rocketOut * L + dx * bob + this.px * 0.06 * this.halfH * 6,
        a.ny * this.halfH + dy * this.state.rocketOut * L + dy * bob - this.py * 0.06 * this.halfH * 6,
        0,
      );
      this.rocket.rotation.z = ang + (reduce ? 0 : Math.sin(t * 0.9) * 0.025);
      this.rocket.rotation.x = 0.12;
      this.rocket.scale.setScalar((a.len * 2 * this.halfH) / 1.1);

      const fl = this.rocket.userData.flame as THREE.Mesh;
      const co = this.rocket.userData.core as THREE.Mesh;
      if (fl && co) {
        const flick = reduce ? 1 : 1 + Math.sin(t * 22) * 0.035 + Math.sin(t * 37) * 0.02;
        const boost = 1 + this.state.warp * 1.4 + Math.max(this.state.rocketOut, 0) * 0.8;
        fl.scale.set(1 + this.state.warp * 0.3, flick * boost, 1);
        co.scale.set(1 + this.state.warp * 0.5, flick * boost, 1);
      }
    }

    if (this.stars) {
      this.stars.rotation.z += dt * 0.004;
      this.stars.position.set(-this.px * 0.5, this.py * 0.4, 0);
    }

    // Warp streaks
    const w = this.state.warp;
    if (this.stMat && this.streaks && this.stGeo) {
      this.stMat.opacity = Math.min(1, w * 1.2);
      this.streaks.visible = w > 0.01;
      if (this.streaks.visible) {
        const sp2 = (10 + w * 150) * dt;
        const len = 0.25 + w * 9;
        const N = 420;
        for (let i = 0; i < N; i++) {
          this.sz[i] += sp2;
          if (this.sz[i] > 10) {
            const a = Math.random() * Math.PI * 2;
            const rr = 1.2 + Math.random() * 14;
            this.sx[i] = Math.cos(a) * rr;
            this.sy[i] = Math.sin(a) * rr;
            this.sz[i] = -60;
          }
          this.sPos[i * 6] = this.sx[i];
          this.sPos[i * 6 + 1] = this.sy[i];
          this.sPos[i * 6 + 2] = this.sz[i];
          this.sPos[i * 6 + 3] = this.sx[i];
          this.sPos[i * 6 + 4] = this.sy[i];
          this.sPos[i * 6 + 5] = this.sz[i] - len;
        }
        this.stGeo.attributes.position.needsUpdate = true;
      }
    }

    // Shockwave wave ring
    if (this.wave && this.rocket) {
      this.wave.visible = this.state.pulse > 0 && this.state.pulse < 1;
      if (this.wave.visible) {
        this.wave.scale.setScalar(0.3 + this.state.pulse * this.halfW * 3.2);
        (this.wave.material as THREE.MeshBasicMaterial).opacity = (1 - this.state.pulse) * 0.55;
        this.wave.position.set(this.rocket.position.x * 0.3, this.rocket.position.y * 0.3, 1);
      }
    }

    this.sunView.value.copy(this.keyLight.position).normalize().transformDirection(this.camera.matrixWorldInverse);
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (!this.renderer) return;
    const p = this.canvas.parentElement;
    const w = p?.clientWidth || window.innerWidth;
    const h = p?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.halfH = D * Math.tan((BASE_FOV * Math.PI) / 360);
    this.halfW = this.halfH * this.camera.aspect;
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrame);
    this.animFrame = 0;
    window.removeEventListener("pointermove", this.onPointerMove);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener("resize", this.onResize);
    }

    this.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        for (const val of Object.values(m)) {
          if (val && typeof val === "object" && "dispose" in val && typeof (val as { dispose: () => void }).dispose === "function") {
            (val as { dispose: () => void }).dispose();
          }
        }
        m.dispose();
      }
    });

    this.renderer?.dispose();
    this.renderer = null;
  }
}
