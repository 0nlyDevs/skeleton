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
  Mesh,
  PerspectiveCamera,
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
 * The view from the ship before landing: the planet turning below, its thin
 * air glowing on the lit edge, clouds, ships on orbit, the ringed sister
 * planet far behind, and a beacon where the island is. `dive` flies the camera
 * down onto that beacon.
 */

const PLANET_URL = "/models/nova.glb";
const PLANET_SIZE = 2_873_024;

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

const NEBULA_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_VERTEX = /* glsl */ `
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
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * lit * 1.1, cover * 0.6);
  }
`;

const GIANT_FRAGMENT = /* glsl */ `
  uniform sampler2D uNoise;
  uniform vec3 uSunView;
  varying vec3 vObj;
  varying vec3 vNormalView;
  void main() {
    vec3 d = normalize(vObj);
    float bands = sin(d.y * 16.0 + texture2D(uNoise, vec2(atan(d.x, d.z) * 0.16, d.y * 0.5)).r * 3.0);
    vec3 col = mix(vec3(0.72, 0.46, 0.3), vec3(0.95, 0.82, 0.66), bands * 0.5 + 0.5);
    float lit = smoothstep(-0.05, 0.6, dot(normalize(vNormalView), uSunView));
    gl_FragColor = vec4(col * lit * 0.9, 1.0);
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
    gl_FragColor = vec4(vec3(0.9, 0.8, 0.68) * 0.6, a * 0.7);
  }
`;

const TRAFFIC_VERTEX = /* glsl */ `
  attribute vec4 aLane;
  uniform float uTime;
  uniform float uPixels;
  varying float vFace;
  void main() {
    float angle = uTime * aLane.y + aLane.z;
    vec3 at = vec3(cos(angle), 0.0, sin(angle)) * aLane.x;
    float tilt = aLane.w;
    at = vec3(at.x, at.z * sin(tilt), at.z * cos(tilt));
    vec4 view = modelViewMatrix * vec4(at, 1.0);
    vFace = 1.0;
    gl_PointSize = max(1.6, 0.012 * uPixels / max(-view.z, 0.01));
    gl_Position = projectionMatrix * view;
  }
`;

const TRAFFIC_FRAGMENT = /* glsl */ `
  varying float vFace;
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a * a * 2.4 * vFace, 1.0);
  }
`;

function glowMaterial(fragmentShader: string, back: boolean, sunView: { value: Vector3 }, color: Color): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader,
    uniforms: { uColor: { value: color }, uSunView: sunView, uIntensity: { value: 1.15 } },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    ...(back ? { side: BackSide } : {}),
  });
}

export interface OrbitView {
  /** 0 → 1 while the ship drifts closer during the wait. */
  readonly approach: number;
  /** 0 → 1: the plunge to the surface. */
  readonly dive: number;
  readonly shake: number;
  readonly pointerX: number;
  readonly pointerY: number;
}

export class OrbitScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(34, 1, 0.01, 600);
  /** Where the island's beacon is on screen (0 … 1 from the top left), for the HUD label. */
  readonly beacon = { x: 0.5, y: 0.5, visible: false };

  private readonly pivot = new Group();
  private readonly spinner = new Group();
  private readonly sun = new DirectionalLight("#fff1e0", 3.1);
  private readonly sunView = { value: new Vector3() };
  private readonly time = { value: 0 };
  private readonly pixels = { value: 800 };
  private readonly marker = new Group();
  private readonly markerRing: Mesh;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly target = new Vector3();
  private readonly world = new Vector3();
  private readonly normal = new Vector3();
  private aspect = 1;

  constructor(noise: Texture) {
    const random = seeded(77);
    this.sun.position.set(-5, 2.6, 4.4);
    this.scene.add(this.sun, new AmbientLight("#20304f", 0.14));

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
    nebula.scale.setScalar(400);
    nebula.renderOrder = -5;

    // The planet's air and clouds; the globe itself arrives in `load`.
    const sphere = new SphereGeometry(1, 96, 64);
    const air = new Color("#ffb890");
    const halo = new Mesh(sphere, glowMaterial(atmosphereFragment, true, this.sunView, air));
    halo.scale.setScalar(1.05);
    const rim = new Mesh(sphere, glowMaterial(rimFragment, false, this.sunView, air));
    rim.scale.setScalar(1.006);
    const cloudMaterial = new ShaderMaterial({
      vertexShader: CLOUD_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
      uniforms: { uNoise: { value: noise }, uSunView: this.sunView, uTime: this.time },
      transparent: true,
      depthWrite: false,
    });
    const clouds = new Mesh(sphere, cloudMaterial);
    clouds.scale.setScalar(1.012);

    // The island's beacon, fixed on the ground so it turns with the planet.
    const markerGeometry = new TorusGeometry(0.035, 0.0022, 6, 48);
    const markerMaterial = new ShaderMaterial({
      vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "void main() { gl_FragColor = vec4(vec3(1.0, 0.5, 0.16) * 4.0, 1.0); }",
      depthWrite: false,
    });
    this.markerRing = new Mesh(markerGeometry, markerMaterial);
    const markerDot = new Mesh(new SphereGeometry(0.006, 12, 8), markerMaterial);
    this.marker.add(this.markerRing, markerDot);
    this.marker.position.set(-0.36, 0.3, 0.885).normalize().multiplyScalar(1.004);
    this.marker.lookAt(this.marker.position.clone().multiplyScalar(2));
    this.spinner.add(this.marker);
    this.spinner.rotation.z = 0.2;

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
    const giantMaterial = new ShaderMaterial({ vertexShader: CLOUD_VERTEX, fragmentShader: GIANT_FRAGMENT, uniforms: { uNoise: { value: noise }, uSunView: this.sunView } });
    const giant = new Mesh(sphere, giantMaterial);
    const ringGeometry = new RingGeometry(1.3, 2.35, 96, 1);
    const ringMaterial = new ShaderMaterial({ vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, transparent: true, depthWrite: false, side: DoubleSide });
    const ring = new Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2 - 0.3;
    const sister = new Group();
    sister.add(giant, ring);
    sister.position.set(-6, 21, -120);
    sister.rotation.z = 0.42;
    sister.scale.setScalar(5.2);

    this.pivot.add(this.spinner, halo, rim, clouds, traffic);
    this.scene.add(nebula, stars, sister, this.pivot);
    this.disposables.push(starGeometry, starMaterial, shell, nebulaMaterial, sphere, halo.material as Material, rim.material as Material, cloudMaterial, markerGeometry, markerMaterial, markerDot.geometry, trafficGeometry, trafficMaterial, giantMaterial, ringGeometry, ringMaterial);
  }

  /** Downloads the planet; `onProgress` receives 0 → 1 from real bytes. */
  async load(onProgress: (value: number) => void, anisotropy: number): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(PLANET_URL, (event) => onProgress(Math.min(1, event.loaded / PLANET_SIZE)));
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

    // The planet sits beside the access panel on a wide screen, above it on a tall one.
    const wide = this.aspect > 1.05;
    const side = wide ? 1.05 : 0;
    const lift = wide ? -0.05 : 0.62;
    this.pivot.position.set(0, 0, 0);
    this.pivot.updateMatrixWorld(true);
    this.marker.getWorldPosition(this.world);
    this.normal.copy(this.world).normalize();

    const distance = (wide ? 5.6 : 7.4) - view.approach * 0.9;
    this.from.set(-side * distance * 0.3, -lift * distance * 0.3 + 0.35, distance);
    this.to.copy(this.world).addScaledVector(this.normal, 0.05);
    const dive = view.dive * view.dive * (3 - 2 * view.dive);
    this.camera.position.copy(this.from).lerp(this.to, dive);
    this.camera.position.x += Math.sin(time * 0.13) * 0.05 * (1 - dive) + (Math.sin(time * 39) + Math.sin(time * 27)) * view.shake * 0.012;
    this.camera.position.y += Math.cos(time * 0.11) * 0.04 * (1 - dive) + Math.sin(time * 43) * view.shake * 0.012;
    this.target.set(-side * distance * 0.3, -lift * distance * 0.3, 0).lerp(this.world, Math.min(1, dive * 1.6));
    this.camera.lookAt(this.target);
    this.camera.rotateY(-view.pointerX * 0.03 * (1 - dive));
    this.camera.rotateX(-view.pointerY * 0.02 * (1 - dive));
    this.camera.rotateZ(dive * 0.5);
    this.camera.fov = 34 + dive * 34;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    this.sunView.value.copy(this.sun.position).normalize().transformDirection(this.camera.matrixWorldInverse);

    // Where the beacon is on screen, and whether the planet hides it.
    const facing = this.normal.dot(this.to.copy(this.from).sub(this.world).normalize());
    this.world.project(this.camera);
    this.beacon.x = this.world.x * 0.5 + 0.5;
    this.beacon.y = 0.5 - this.world.y * 0.5;
    this.beacon.visible = facing > 0.12 && view.dive < 0.02;
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.scene.clear();
  }
}
