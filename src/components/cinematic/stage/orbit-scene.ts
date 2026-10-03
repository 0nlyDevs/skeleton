import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { atmosphereFragment, atmosphereVertex, rimFragment } from "../planet-shaders";
import { seeded } from "./noise";

/**
 * The view from the ship before landing. It opens on the system's star (the
 * one the loader showed), then the planet swings in on its orbit and settles
 * in front of the ship, lit from the side, its thin air glowing on the edge,
 * and a beacon where the island is, at the line of dawn. `dive` then flies the
 * camera down onto that beacon, with the dust of space streaking past.
 */

const PLANET_URL = "/models/nova.glb";
const PLANET_SIZE = 2_873_024;

/** Where the star is in the sky, and so where the light comes from. */
const SUN = new Vector3(-0.97, 0.2, -0.05).normalize();
/** The island's place on the globe: on the line between night and day. */
const BEACON = new Vector3(-0.12, 0.25, 0.96).normalize();

const SUN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* A star as a telescope shows it: a white-hot core, a soft halo and four long diffraction spikes. */
const SUN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    vec2 a = abs(p);
    float core = smoothstep(0.014, 0.0, r) * 36.0;
    float halo = exp(-r * 26.0) * 2.4 + exp(-r * 7.0) * 0.4;
    float spikes = exp(-a.y * 520.0) * exp(-a.x * 7.5) + exp(-a.x * 520.0) * exp(-a.y * 7.5);
    vec2 d = abs(mat2(0.7071, -0.7071, 0.7071, 0.7071) * p);
    float thin = (exp(-d.y * 700.0) * exp(-d.x * 16.0) + exp(-d.x * 700.0) * exp(-d.y * 16.0)) * 0.35;
    float flicker = 0.95 + 0.05 * sin(uTime * 7.0) * sin(uTime * 3.1);
    vec3 col = vec3(1.0, 0.93, 0.82) * (core + halo) + vec3(0.85, 0.9, 1.0) * spikes * 1.6 + vec3(1.0, 0.8, 0.6) * thin;
    // The light dies out before the edge of the sprite, so no square shows.
    gl_FragColor = vec4(col * flicker * uPower * smoothstep(0.5, 0.28, max(a.x, a.y)), 1.0);
  }
`;

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uPixels;
  varying vec3 vCol;
  void main() {
    vCol = aColor;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixels;
    gl_Position = projectionMatrix * view;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vCol;
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vCol * a * a, 1.0);
  }
`;

/* Dust around the ship. Each grain is a short line stretched along the flight, so speed shows as streaks. */
const DUST_VERTEX = /* glsl */ `
  attribute float aEnd;
  uniform vec3 uShip;
  uniform vec3 uStretch;
  varying float vFade;
  void main() {
    vec3 p = mod(position - uShip + 12.0, 24.0) - 12.0 + uShip;
    p += uStretch * aEnd;
    vec4 view = viewMatrix * vec4(p, 1.0);
    vFade = (1.0 - aEnd * 0.85) * smoothstep(12.0, 5.0, length(view.xyz)) * smoothstep(0.2, 1.2, length(view.xyz));
    gl_Position = projectionMatrix * view;
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  uniform float uPower;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(vec3(0.82, 0.9, 1.0) * vFade * uPower, 1.0);
  }
`;

const NEBULA_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT = /* glsl */ `
  uniform sampler2D uNoise;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float a = texture2D(uNoise, d.xy * 0.55 + d.z * 0.31).r;
    float b = texture2D(uNoise, d.zy * 1.3 + d.x * 0.17).a;
    float cloud = smoothstep(0.45, 0.95, a * 0.65 + b * 0.35);
    vec3 col = mix(vec3(0.09, 0.05, 0.16), vec3(0.3, 0.12, 0.08), b) * cloud * 0.16;
    col += vec3(0.004, 0.006, 0.014);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalView;
  void main() {
    vObj = position;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D uNoise;
  uniform vec3 uSunView;
  uniform float uTime;
  varying vec3 vObj;
  varying vec3 vNormalView;
  void main() {
    vec3 d = normalize(vObj);
    // Two flat projections blended by direction: no seam, unlike a wrap around the globe.
    vec2 drift = vec2(uTime * 0.0015, 0.0);
    vec2 front = d.xy * vec2(0.5, 0.9) + drift;
    vec2 side = d.zy * vec2(0.5, 0.9) + 0.37 - drift;
    float swirl = texture2D(uNoise, front * 0.7).r;
    float af = texture2D(uNoise, front * 1.7 + swirl * 0.1).r * 0.6 + texture2D(uNoise, front * 4.6).a * 0.4;
    float as = texture2D(uNoise, side * 1.7 + swirl * 0.1).r * 0.6 + texture2D(uNoise, side * 4.6).a * 0.4;
    float a = mix(as, af, smoothstep(0.35, 0.65, abs(d.z)));
    float cover = smoothstep(0.52, 0.78, a) * (1.0 - smoothstep(0.75, 0.98, abs(d.y)));
    float lit = smoothstep(-0.12, 0.5, dot(normalize(vNormalView), uSunView));
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * (lit * 1.1 + 0.03), cover * 0.6);
  }
`;

const GIANT_FRAGMENT = /* glsl */ `
  uniform sampler2D uNoise;
  uniform vec3 uSunView;
  varying vec3 vObj;
  varying vec3 vNormalView;
  void main() {
    vec3 d = normalize(vObj);
    float bands = sin(d.y * 16.0 + texture2D(uNoise, d.xy * 0.3 + d.z * 0.2).r * 3.0);
    vec3 col = mix(vec3(0.72, 0.46, 0.3), vec3(0.95, 0.82, 0.66), bands * 0.5 + 0.5);
    float lit = smoothstep(-0.05, 0.6, dot(normalize(vNormalView), uSunView));
    gl_FragColor = vec4(col * (lit * 0.9 + 0.012), 1.0);
  }
`;

const RING_VERTEX = /* glsl */ `
  varying vec2 vAt;
  void main() {
    vAt = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  varying vec2 vAt;
  void main() {
    float r = length(vAt);
    float lanes = 0.55 + 0.45 * sin(r * 34.0);
    float a = smoothstep(1.35, 1.45, r) * smoothstep(2.3, 2.2, r) * lanes;
    gl_FragColor = vec4(vec3(0.9, 0.8, 0.68) * 0.5, a * 0.6);
  }
`;

const TRAFFIC_VERTEX = /* glsl */ `
  attribute vec4 aLane;
  uniform float uTime;
  uniform float uPixels;
  void main() {
    float angle = uTime * aLane.y + aLane.z;
    vec3 at = vec3(cos(angle), 0.0, sin(angle)) * aLane.x;
    at = vec3(at.x, at.z * sin(aLane.w), at.z * cos(aLane.w));
    vec4 view = modelViewMatrix * vec4(at, 1.0);
    gl_PointSize = max(1.6, 0.012 * uPixels / max(-view.z, 0.01));
    gl_Position = projectionMatrix * view;
  }
`;

const TRAFFIC_FRAGMENT = /* glsl */ `
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a * a * 2.4, 1.0);
  }
`;

function glowMaterial(fragmentShader: string, back: boolean, sunView: { value: Vector3 }, color: Color): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader,
    uniforms: { uColor: { value: color }, uSunView: sunView, uIntensity: { value: 1.5 } },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    ...(back ? { side: BackSide } : {}),
  });
}

export interface OrbitView {
  /** 0 → 1: the view leaves the star, the planet swings in and settles. */
  readonly arrive: number;
  /** 0 → 1: the flight down to the island's beacon. */
  readonly dive: number;
  /** 0 → 1: how long the streaks of dust are. */
  readonly warp: number;
  readonly shake: number;
  readonly pointerX: number;
  readonly pointerY: number;
}

const DUST = 1500;

export class OrbitScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(34, 1, 0.01, 800);
  /** Where the island's beacon is on screen (0 … 1 from the top left), for its label. */
  readonly beacon = { x: 0.5, y: 0.5, visible: false };

  private readonly pivot = new Group();
  private readonly spinner = new Group();
  private readonly light = new DirectionalLight("#fff1e0", 3.4);
  private readonly sunView = { value: new Vector3() };
  private readonly time = { value: 0 };
  private readonly pixels = { value: 800 };
  private readonly marker = new Group();
  private readonly markerRing: Mesh;
  private readonly sunPower = { value: 1 };
  private readonly sun: Mesh;
  private readonly dustShip = { value: new Vector3() };
  private readonly dustStretch = { value: new Vector3() };
  private readonly dustPower = { value: 0 };
  private readonly disposables: { dispose(): void }[] = [];
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly target = new Vector3();
  private readonly world = new Vector3();
  private readonly normal = new Vector3();
  private readonly ahead = new Vector3();
  private aspect = 1;

  constructor(noise: Texture) {
    const random = seeded(77);
    this.light.position.copy(SUN).multiplyScalar(20);
    // The night side is never pitch black: the sister planet shines on it.
    const shine = new DirectionalLight("#8ea6ff", 0.55);
    shine.position.set(4, 1.5, 6);
    this.scene.add(this.light, shine, new AmbientLight("#20304f", 0.1));

    // Stars.
    const count = 3600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1;
      const a = random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions.set([Math.cos(a) * s * 300, u * 300, Math.sin(a) * s * 300], i * 3);
      const power = random() ** 6 * 5 + 0.25;
      const warm = random();
      colors.set([power * (0.8 + warm * 0.3), power * 0.9, power * (1.1 - warm * 0.35)], i * 3);
      sizes[i] = 0.0016 + random() ** 4 * 0.004;
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    starGeometry.setAttribute("aColor", new BufferAttribute(colors, 3));
    starGeometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    const starMaterial = new ShaderMaterial({ vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, uniforms: { uPixels: this.pixels }, blending: AdditiveBlending, transparent: true, depthWrite: false });
    const stars = new Points(starGeometry, starMaterial);
    stars.frustumCulled = false;

    const shell = new SphereGeometry(1, 32, 24);
    const nebulaMaterial = new ShaderMaterial({ vertexShader: NEBULA_VERTEX, fragmentShader: NEBULA_FRAGMENT, uniforms: { uNoise: { value: noise } }, side: BackSide, depthWrite: false });
    const nebula = new Mesh(shell, nebulaMaterial);
    nebula.scale.setScalar(500);
    nebula.renderOrder = -5;

    // The star itself.
    const sunGeometry = new PlaneGeometry(1, 1);
    const sunMaterial = new ShaderMaterial({ vertexShader: SUN_VERTEX, fragmentShader: SUN_FRAGMENT, uniforms: { uTime: this.time, uPower: this.sunPower }, blending: AdditiveBlending, transparent: true, depthWrite: false });
    this.sun = new Mesh(sunGeometry, sunMaterial);
    this.sun.position.copy(SUN).multiplyScalar(260);
    this.sun.scale.setScalar(96);
    this.sun.renderOrder = -2;

    // Dust for the flight.
    const grains = new Float32Array(DUST * 6);
    const ends = new Float32Array(DUST * 2);
    for (let i = 0; i < DUST; i += 1) {
      const x = random() * 24;
      const y = random() * 24;
      const z = random() * 24;
      grains.set([x, y, z, x, y, z], i * 6);
      ends[i * 2 + 1] = 1;
    }
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute("position", new BufferAttribute(grains, 3));
    dustGeometry.setAttribute("aEnd", new BufferAttribute(ends, 1));
    const dustMaterial = new ShaderMaterial({
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      uniforms: { uShip: this.dustShip, uStretch: this.dustStretch, uPower: this.dustPower },
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const dust = new LineSegments(dustGeometry, dustMaterial);
    dust.frustumCulled = false;

    // The planet's air and clouds; the globe itself arrives in `load`.
    const sphere = new SphereGeometry(1, 96, 64);
    const air = new Color("#ffb890");
    const halo = new Mesh(sphere, glowMaterial(atmosphereFragment, true, this.sunView, air));
    halo.scale.setScalar(1.055);
    const rim = new Mesh(sphere, glowMaterial(rimFragment, false, this.sunView, air));
    rim.scale.setScalar(1.006);
    const cloudMaterial = new ShaderMaterial({
      vertexShader: SHELL_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
      uniforms: { uNoise: { value: noise }, uSunView: this.sunView, uTime: this.time },
      transparent: true,
      depthWrite: false,
    });
    const clouds = new Mesh(sphere, cloudMaterial);
    clouds.scale.setScalar(1.012);

    // The island's beacon.
    const markerGeometry = new TorusGeometry(0.035, 0.0022, 6, 48);
    const markerMaterial = new ShaderMaterial({
      vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "void main() { gl_FragColor = vec4(vec3(1.0, 0.5, 0.16) * 4.0, 1.0); }",
      depthWrite: false,
    });
    this.markerRing = new Mesh(markerGeometry, markerMaterial);
    const markerDot = new Mesh(new SphereGeometry(0.006, 12, 8), markerMaterial);
    this.marker.add(this.markerRing, markerDot);
    this.marker.position.copy(BEACON).multiplyScalar(1.004);
    this.marker.lookAt(BEACON.clone().multiplyScalar(2));

    // Ships waiting on orbit.
    const lanes = new Float32Array(42 * 4);
    for (let i = 0; i < 42; i += 1) lanes.set([1.16 + random() * 0.5, (0.05 + random() * 0.09) * (random() < 0.5 ? -1 : 1), random() * 6.28, (random() - 0.5) * 1.1], i * 4);
    const trafficGeometry = new BufferGeometry();
    trafficGeometry.setAttribute("position", new BufferAttribute(new Float32Array(42 * 3), 3));
    trafficGeometry.setAttribute("aLane", new BufferAttribute(lanes, 4));
    const trafficMaterial = new ShaderMaterial({ vertexShader: TRAFFIC_VERTEX, fragmentShader: TRAFFIC_FRAGMENT, uniforms: { uTime: this.time, uPixels: this.pixels }, blending: AdditiveBlending, transparent: true, depthWrite: false });
    const traffic = new Points(trafficGeometry, trafficMaterial);
    traffic.frustumCulled = false;

    // The ringed sister planet, far away: the same one that hangs in the island's sky.
    const giantMaterial = new ShaderMaterial({ vertexShader: SHELL_VERTEX, fragmentShader: GIANT_FRAGMENT, uniforms: { uNoise: { value: noise }, uSunView: this.sunView } });
    const giant = new Mesh(sphere, giantMaterial);
    const ringGeometry = new RingGeometry(1.3, 2.35, 96, 1);
    const ringMaterial = new ShaderMaterial({ vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, transparent: true, depthWrite: false, side: DoubleSide });
    const ring = new Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2 - 0.3;
    const sister = new Group();
    sister.add(giant, ring);
    sister.position.set(34, 26, -120);
    sister.rotation.z = 0.42;
    sister.scale.setScalar(5.2);

    // The beacon does not turn with the globe: it stays on the line of dawn, where the island is.
    this.pivot.add(this.spinner, this.marker, halo, rim, clouds, traffic);
    this.scene.add(nebula, stars, this.sun, sister, this.pivot, dust);
    this.disposables.push(starGeometry, starMaterial, shell, nebulaMaterial, sunGeometry, sunMaterial, dustGeometry, dustMaterial, sphere, halo.material as Material, rim.material as Material, cloudMaterial, markerGeometry, markerMaterial, markerDot.geometry, trafficGeometry, trafficMaterial, giantMaterial, ringGeometry, ringMaterial);
  }

  /** Downloads the planet; `onProgress` receives 0 → 1 from real bytes. */
  async load(onProgress: (value: number) => void, anisotropy: number): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(PLANET_URL, (event) => onProgress(Math.min(1, event.loaded / (event.total || PLANET_SIZE))));
    onProgress(1);
    const planet: Object3D = gltf.scene;
    const box = new Box3().setFromObject(planet);
    const size = box.getSize(new Vector3());
    const scale = 2 / Math.max(size.x, size.y, size.z);
    planet.position.sub(box.getCenter(new Vector3()).multiplyScalar(scale));
    planet.scale.setScalar(scale);
    planet.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      this.disposables.push(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        this.disposables.push(material);
        if ("transmission" in material) (material as Material & { transmission: number }).transmission = 0;
        for (const value of Object.values(material)) {
          if (value && typeof value === "object" && "isTexture" in value) {
            (value as Texture).anisotropy = anisotropy;
            this.disposables.push(value as Texture);
          }
        }
      }
    });
    this.spinner.add(planet);
    this.spinner.rotation.z = 0.2;
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  setDrawHeight(pixels: number): void {
    this.pixels.value = pixels;
  }

  update(view: OrbitView, time: number, dt: number): void {
    this.time.value = time;
    this.spinner.rotation.y += dt * 0.012;
    this.markerRing.scale.setScalar(1 + ((time * 0.6) % 1) * 1.6);

    // The planet comes round on its orbit and stops beside the star.
    const away = (1 - view.arrive) ** 3;
    this.pivot.position.set(7.4 * away ** 1.4, 0.7 * away, -11 * away);
    this.pivot.updateMatrixWorld(true);
    this.marker.getWorldPosition(this.world);
    this.normal.copy(this.world).sub(this.pivot.position).normalize();

    // From the star to the planet, then down to the beacon.
    const wide = this.aspect > 1.05;
    const look = view.arrive * view.arrive * (3 - 2 * view.arrive);
    this.from.set(wide ? 1.35 : 0.2, wide ? 0.3 : -0.5, (wide ? 5.9 : 7.6) + (1 - look) * 1.4);
    this.to.copy(this.world).addScaledVector(this.normal, 0.05);
    const dive = view.dive;
    this.camera.position.copy(this.from).lerp(this.to, dive);
    this.camera.position.x += Math.sin(time * 0.13) * 0.05 * (1 - dive) + (Math.sin(time * 39) + Math.sin(time * 27)) * view.shake * 0.01;
    this.camera.position.y += Math.cos(time * 0.11) * 0.04 * (1 - dive) + Math.sin(time * 43) * view.shake * 0.01;
    this.target.copy(this.from).addScaledVector(SUN, 10).lerp(this.ahead.set(wide ? -0.75 : 0, wide ? 0.05 : 0.9, 0), look).lerp(this.world, Math.min(1, dive * 1.8));
    this.camera.lookAt(this.target);
    this.camera.rotateY(-view.pointerX * 0.03 * (1 - dive));
    this.camera.rotateX(-view.pointerY * 0.02 * (1 - dive));
    this.camera.rotateZ(dive * 0.45);
    this.camera.fov = 34 + view.warp * 14 + dive * dive * 30;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    this.sunView.value.copy(SUN).transformDirection(this.camera.matrixWorldInverse);
    this.sun.quaternion.copy(this.camera.quaternion);
    this.sunPower.value = 1 - dive * 0.6;

    // Streaks: every grain of dust is drawn from where it is to where it was a moment ago.
    this.camera.getWorldDirection(this.ahead);
    this.dustShip.value.copy(this.camera.position);
    this.dustStretch.value.copy(this.ahead).multiplyScalar(0.02 + view.warp * 3.4);
    this.dustPower.value = 0.12 + view.warp * 0.9;

    // Where the beacon is on screen, and whether the planet hides it.
    const facing = this.normal.dot(this.to.copy(this.from).sub(this.world).normalize());
    this.world.project(this.camera);
    this.beacon.x = this.world.x * 0.5 + 0.5;
    this.beacon.y = 0.5 - this.world.y * 0.5;
    this.beacon.visible = facing > 0.12 && view.arrive > 0.9 && view.dive < 0.02;
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.scene.clear();
  }
}
