import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from "three";

import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { waterwayAt } from "@/components/city-map/city-map-terrain";

import { ATMOSPHERE_GLSL, patchStandard, type Atmosphere } from "./atmosphere";
import { seeded, type NoiseField } from "./noise";
import { toWorld, type WorldTerrain } from "./world-terrain";

/**
 * What stands on the island: the capital's towers, the Senate Spire, the
 * spaceport, the harbour, the forges, the observatory, forests, crystals,
 * basalt columns, the maglev lines with their trains and the shuttles of the
 * Skyport. Every place sits where the city map (`CITY_PLACES`) puts it.
 * Everything is drawn from a small kit of shapes, as instances, so the whole
 * city costs a few dozen draw calls.
 */

const Z = { CRYSTAL: 0, VERDANT: 1, EMBER: 2, FROST: 3, DELTA: 4, NOVA: 5, OBSIDIAN: 6, SKYPORT: 7 } as const;

const tone = (hex: string) => new Color(hex);
const WHITE = tone("#f2ede5");
const SAND = tone("#dccbb4");
const CLAY = tone("#c99f86");
const STONE = tone("#b9ada0");
const SLATE = tone("#7d8792");
const PAD = tone("#3d4046");
const BASALT = tone("#1b1b1f");
const IRON = tone("#2f2a29");
const TOWERS = [WHITE, WHITE, WHITE, SAND, SAND, CLAY, STONE, SLATE];
const AWNINGS = [tone("#e8a23a"), tone("#e2574c"), tone("#2e9c9a"), tone("#c7458f"), tone("#f0d9a8"), tone("#5d7fd6")];
const GREENS = [tone("#263d22"), tone("#2f4a27"), tone("#3a5628"), tone("#44602b"), tone("#52682d"), tone("#3d4f24")];
const PINES = [tone("#1f3324"), tone("#27402b"), tone("#2e4a30")];
const EXOTIC = [tone("#5e3a26"), tone("#6b4a2a"), tone("#4e2f33")];
const CRYSTALS = [tone("#b9a6ff"), tone("#8fe3ff"), tone("#ffb3e6"), tone("#d9f2ff")];
const LAMP_WARM = new Color(1, 0.62, 0.3);
const LAMP_COOL = new Color(0.55, 0.8, 1);
const LAMP_RED = new Color(1, 0.12, 0.08);
const LAMP_PAD = new Color(1, 0.45, 0.12);
const LAMP_POOL = new Color(0.2, 0.9, 0.85);
const LAMP_LAVA = new Color(1, 0.36, 0.08);

const _matrix = new Matrix4();
const _position = new Vector3();
const _scale = new Vector3();
const _quaternion = new Quaternion();
const _euler = new Euler();
const _direction = new Vector3();
const UP = new Vector3(0, 1, 0);
const AHEAD = new Vector3(1, 0, 0);

/** Collects copies of one shape, then turns them into a single instanced mesh. */
class Batch {
  private readonly matrices: number[] = [];
  private readonly tints: number[] = [];

  constructor(
    private readonly geometry: BufferGeometry,
    private readonly material: Material,
    private readonly shadows = true,
    private readonly order = 0,
  ) {}

  /** `y` is the base of the shape; sizes are full width, height and depth. */
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, tint: Color, turn = 0, tiltX = 0, tiltZ = 0): void {
    _matrix.compose(_position.set(x, y, z), _quaternion.setFromEuler(_euler.set(tiltX, turn, tiltZ, "YXZ")), _scale.set(sx, sy, sz));
    this.push(tint);
  }

  /** A bar of the shape from `a` to `b`. */
  span(a: Vector3, b: Vector3, thickness: number, tint: Color): void {
    _direction.subVectors(b, a);
    const length = _direction.length();
    if (length < 1e-5) return;
    _matrix.compose(a, _quaternion.setFromUnitVectors(UP, _direction.divideScalar(length)), _scale.set(thickness, length, thickness));
    this.push(tint);
  }

  private push(tint: Color): void {
    for (let i = 0; i < 16; i += 1) this.matrices.push(_matrix.elements[i] ?? 0);
    this.tints.push(tint.r, tint.g, tint.b);
  }

  build(): InstancedMesh | null {
    const count = this.tints.length / 3;
    if (count === 0) return null;
    const mesh = new InstancedMesh(this.geometry, this.material, count);
    (mesh.instanceMatrix.array as Float32Array).set(this.matrices);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.tints), 3);
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = this.shadows;
    mesh.renderOrder = this.order;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

/** Small lights seen as glowing dots: lamps, beacons, drones. */
class Lamps {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly specs: number[] = [];
  readonly orbits: number[] = [];

  add(at: { x: number; y: number; z: number }, color: Color, size: number, options: { always?: boolean; blink?: number; orbit?: readonly [number, number] } = {}): void {
    this.positions.push(at.x, at.y, at.z);
    this.colors.push(color.r, color.g, color.b);
    this.specs.push(size * 0.6, options.always ? 1 : 0, options.blink ?? 0, Math.abs(Math.sin(at.x * 12.9 + at.z * 78.2)));
    this.orbits.push(options.orbit?.[0] ?? 0, options.orbit?.[1] ?? 0);
  }

  geometry(dynamic = false): BufferGeometry {
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(new Float32Array(this.positions), 3);
    if (dynamic) position.setUsage(DynamicDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setAttribute("aColor", new BufferAttribute(new Float32Array(this.colors), 3));
    geometry.setAttribute("aSpec", new BufferAttribute(new Float32Array(this.specs), 4));
    geometry.setAttribute("aOrbit", new BufferAttribute(new Float32Array(this.orbits), 2));
    return geometry;
  }
}

const WINDOWS_VERTEX_PARS = /* glsl */ `
  attribute float aRound;
  varying vec3 vTnLocal;
  varying vec3 vTnFace;
  varying float vTnSeed;
  varying float vTnRound;
`;

const WINDOWS_VERTEX = /* glsl */ `
  vec3 tnSize = vec3(1.0);
  vTnSeed = 0.37;
  #ifdef USE_INSTANCING
    tnSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vTnSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  #endif
  vTnLocal = position * tnSize;
  vTnFace = normal;
  vTnRound = aRound;
`;

const WINDOWS_PARS = /* glsl */ `
  varying vec3 vTnLocal;
  varying vec3 vTnFace;
  varying float vTnSeed;
  varying float vTnRound;
  float tnPane;
`;

/*
 * Facades. Each building picks one of three looks from its own seed: separate
 * windows, long ribbons of glass, or a full glass wall. Dark glass by day; at
 * night the windows light up one by one. Far away, where a window is smaller
 * than a pixel, the wall takes the average of its windows instead of flickering.
 */
const WINDOWS_COLOR = /* glsl */ `
  {
    vec3 face = normalize(vTnFace);
    float wall = (1.0 - smoothstep(0.35, 0.6, abs(face.y))) * step(0.1, diffuseColor.g);
    float along = vTnRound > 0.5
      ? atan(vTnLocal.z, vTnLocal.x) * max(length(vTnLocal.xz), 0.001)
      : (abs(face.x) > 0.5 ? vTnLocal.z : vTnLocal.x);
    float style = fract(vTnSeed * 7.31);
    vec2 size = style < 0.45 ? vec2(0.0044, 0.0042) : (style < 0.75 ? vec2(0.028, 0.0042) : vec2(0.0034, 0.0042));
    vec2 wuv = vec2(along, vTnLocal.y) / size;
    vec2 wid = floor(wuv);
    vec2 wf = fract(wuv);
    float pane = style < 0.45
      ? step(0.2, wf.x) * step(wf.x, 0.8) * step(0.25, wf.y) * step(wf.y, 0.78)
      : (style < 0.75 ? step(0.3, wf.y) * step(wf.y, 0.8) : step(0.07, wf.x) * step(0.12, wf.y));
    float cover = style < 0.45 ? 0.32 : (style < 0.75 ? 0.5 : 0.82);
    float footprint = max(fwidth(along) / size.x, fwidth(vTnLocal.y) / size.y);
    float close = 1.0 - smoothstep(0.35, 0.9, footprint);
    float middle = 1.0 - smoothstep(0.35, 0.9, footprint / 3.0);
    float upper = step(1.0, wuv.y);
    float pick = fract(sin(dot(wid + vTnSeed * 41.0, vec2(127.1, 311.7))) * 43758.5453);
    float lit = step(1.0 - (0.2 + 0.4 * vTnSeed) * uLights, pick);
    // Further away, windows light up in groups, so a tower still sparkles when its windows blur.
    float group = fract(sin(dot(floor(wuv / vec2(style < 0.45 || style >= 0.75 ? 3.0 : 1.0, 3.0)) + vTnSeed * 17.0, vec2(269.5, 183.3))) * 43758.5453);
    float far = mix(cover * 0.1 * (0.3 + 1.2 * vTnSeed), step(1.0 - (0.15 + 0.35 * vTnSeed) * uLights, group) * cover * 1.2, middle);
    tnPane = wall * upper * mix(cover, pane, close);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.035, 0.05), tnPane * 0.9);
    vec3 warm = mix(tnC(1.0, 0.74, 0.42), tnC(0.72, 0.86, 1.0), step(0.82, fract(pick * 7.3)));
    totalEmissiveRadiance += warm * wall * upper * mix(far, pane * lit * 1.9, close) * uLights;
  }
`;

const GLOW_VERTEX = /* glsl */ `
  varying vec3 vTint;
  varying vec3 vWorld;
  void main() {
    vTint = instanceColor;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying vec3 vWorld;
  uniform float uBase;
  ${ATMOSPHERE_GLSL}
  void main() {
    vec3 col = vTint * mix(uBase, 1.0, uLights) * 3.2;
    col = mix(col, tnFogColor(normalize(vWorld - cameraPosition)), tnFogAmount(cameraPosition, vWorld));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const LAMP_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute vec4 aSpec;
  attribute vec2 aOrbit;
  uniform float uPixels;
  varying vec3 vCol;
  ${ATMOSPHERE_GLSL}
  void main() {
    vec3 at = position;
    float angle = uTime * aOrbit.y + aSpec.w * 6.283;
    at.xz += aOrbit.x * vec2(cos(angle), sin(angle));
    vec4 world = modelMatrix * vec4(at, 1.0);
    vec4 view = viewMatrix * world;
    float px = aSpec.x * uPixels / max(-view.z, 0.001);
    float power = mix(uLights, 1.0, aSpec.y);
    if (aSpec.z > 0.0) power *= step(0.6, fract(uTime * aSpec.z + aSpec.w));
    power *= clamp(px / 1.7, 0.2, 1.0) * (1.0 - tnFogAmount(cameraPosition, world.xyz));
    vCol = aColor * power;
    gl_PointSize = max(px, 1.7);
    gl_Position = projectionMatrix * view;
  }
`;

const LAMP_FRAGMENT = /* glsl */ `
  varying vec3 vCol;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vCol * a * a * 2.6, 1.0);
  }
`;

/** A tree's crown: a ball pushed in and out along its surface, flat underneath. */
function crownGeometry(): BufferGeometry {
  // Corners shared between faces: six times fewer points to move for every tree, and a smooth surface.
  const faces = new IcosahedronGeometry(0.5, 1);
  faces.deleteAttribute("normal");
  faces.deleteAttribute("uv");
  const geometry = mergeVertices(faces);
  faces.dispose();
  const position = geometry.getAttribute("position") as BufferAttribute;
  const at = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    at.fromBufferAttribute(position, i).normalize();
    const lump = Math.sin(at.x * 5.3 + at.y * 2.1) * Math.cos(at.z * 4.7 - at.x * 1.9) * 0.2 + Math.sin(at.y * 7.1 + at.z * 3.3) * 0.08;
    at.multiplyScalar(0.5 * (1 + lump));
    if (at.y < -0.12) at.y = -0.12 + (at.y + 0.12) * 0.25;
    position.setXYZ(i, at.x, at.y + 0.4, at.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function unit<T extends BufferGeometry>(geometry: T, round: boolean): T {
  if (round) {
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("aRound", new BufferAttribute(new Float32Array(count).fill(1), 1));
  }
  return geometry;
}

interface Kit {
  readonly terrain: WorldTerrain;
  readonly noise: NoiseField;
  readonly random: () => number;
  readonly box: Batch;
  readonly tube: Batch;
  readonly hex: Batch;
  readonly cone: Batch;
  readonly dome: Batch;
  readonly ball: Batch;
  readonly spire: Batch;
  readonly vault: Batch;
  readonly glassDome: Batch;
  readonly glassVault: Batch;
  /** Glows at night. */
  readonly ring: Batch;
  readonly pool: Batch;
  /** Glows day and night. */
  readonly ember: Batch;
  readonly tree: Batch;
  readonly pine: Batch;
  readonly shard: Batch;
  readonly lamps: Lamps;
  /** Ground position of a map point. */
  ground(mapX: number, mapY: number): Vector3;
  pick<T>(list: readonly T[]): T;
}

/** Calls `each` for `count` random dry-land points of a district that pass `test`. */
function scatter(kit: Kit, zone: number, count: number, test: (mapX: number, mapY: number, ground: Vector3) => boolean, each: (ground: Vector3, mapX: number, mapY: number) => void): void {
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 60; tries += 1) {
    const mapX = 40 + kit.random() * 920;
    const mapY = 40 + kit.random() * 560;
    if (kit.terrain.zoneAt(mapX, mapY) !== zone) continue;
    const ground = kit.ground(mapX, mapY);
    if (ground.y < 0.03 || !test(mapX, mapY, ground)) continue;
    each(ground, mapX, mapY);
    placed += 1;
  }
}

/** A broadleaf crown: lumpy, never the same width twice, leaning a little. */
function tree(kit: Kit, ground: Vector3, size: number, tints: readonly Color[]): void {
  const s = size * 0.42;
  const lean = () => (kit.random() - 0.5) * 0.3;
  kit.tree.add(ground.x, ground.y - s * 0.12, ground.z, s * (0.8 + kit.random() * 0.45), s * (0.75 + kit.random() * 0.6), s * (0.8 + kit.random() * 0.45), kit.pick(tints), kit.random() * 6.28, lean(), lean());
}

/** A conifer, for the cold heights. */
function pine(kit: Kit, ground: Vector3, size: number): void {
  const s = size * 0.42;
  kit.pine.add(ground.x, ground.y - s * 0.05, ground.z, s * 0.7, s * (1.5 + kit.random() * 0.9), s * 0.7, kit.pick(PINES), kit.random() * 6.28, (kit.random() - 0.5) * 0.12, (kit.random() - 0.5) * 0.12);
}

/** A few white pods: the homes, cafés and lodges of the outer districts. */
function pods(kit: Kit, mapX: number, mapY: number, count: number, spread: number, size = 0.05): void {
  for (let i = 0; i < count; i += 1) {
    const g = kit.ground(mapX + (kit.random() - 0.5) * spread, mapY + (kit.random() - 0.5) * spread);
    if (g.y < 0.02) continue;
    const s = size * (0.5 + kit.random() * 0.5);
    kit.dome.add(g.x, g.y - 0.004, g.z, s, s * (0.6 + kit.random() * 0.4), s, kit.random() < 0.8 ? WHITE : SAND);
    kit.lamps.add({ x: g.x + s * 0.6, y: g.y + s * 0.25, z: g.z }, LAMP_WARM, 0.012);
  }
}

const GLASS = [tone("#8fb0c4"), tone("#7f9c98"), tone("#b59a7c"), tone("#9aa5b5")];

function novaPrime(kit: Kit): void {
  const reserved: readonly (readonly [number, number, number])[] = [[430, 290, 16], [520, 310, 20], [350, 300, 22], [620, 320, 10]];
  const tower = (x: number, y: number, z: number, width: number, depth: number, height: number) => {
    const kind = kit.random();
    const tint = kit.random() < 0.3 ? kit.pick(GLASS) : kit.pick(TOWERS);
    if (kind < 0.62) {
      kit.box.add(x, y, z, width, height, depth, tint);
      if (height > 0.16) kit.box.add(x, y + height, z, width * 0.6, height * 0.16, depth * 0.6, tint);
      if (height > 0.26) kit.lamps.add({ x, y: y + height * 1.16 + 0.012, z }, LAMP_RED, 0.016, { always: true, blink: 0.5 });
    } else if (kind < 0.86) {
      const d = Math.min(width, depth);
      kit.tube.add(x, y, z, d, height, d, tint);
      kit.dome.add(x, y + height, z, d, d * 0.35, d, tint);
    } else {
      const d = Math.min(width, depth) * 1.25;
      kit.spire.add(x, y, z, d, height * 1.25, d, tint, kit.random() * 6.28);
    }
  };
  // Nine small blocks in every square of the street grid; a block holds one tower or four smaller buildings.
  for (let i = -12; i < 57; i += 1) {
    for (let j = -3; j < 26; j += 1) {
      const mapX = 324 + 8 * i + 4;
      const mapY = 228 + 8 * j + 4;
      if (kit.terrain.zoneAt(mapX, mapY) !== Z.NOVA || waterwayAt(mapX, mapY) > 0.02) continue;
      const g = kit.ground(mapX, mapY);
      if (g.y < 0.04 || reserved.some(([x, y, r]) => Math.hypot(mapX - x, mapY - y) < r)) continue;
      const core = Math.max(Math.exp(-((mapX - 520) ** 2 + (mapY - 310) ** 2) / 70 ** 2), 0.9 * Math.exp(-((mapX - 430) ** 2 + (mapY - 290) ** 2) / 55 ** 2));
      const roll = kit.random();
      // Away from the centre the city thins out into low houses and empty lots.
      if (core < 0.2 && kit.random() < 0.5 - core * 2) continue;
      if (roll < 0.07) {
        for (let k = 0; k < 7; k += 1) tree(kit, kit.ground(mapX + (kit.random() - 0.5) * 6, mapY + (kit.random() - 0.5) * 6), 0.045 + kit.random() * 0.03, GREENS);
      } else if (roll < 0.07 + 0.3 * core + 0.06) {
        const height = 0.07 + 0.5 * core * (0.35 + kit.random() * 0.75) * (kit.random() < 0.12 ? 1.35 : 1);
        tower(g.x, g.y - 0.012, g.z, 0.07 + kit.random() * 0.04, 0.07 + kit.random() * 0.04, height);
      } else {
        for (let lot = 0; lot < 4; lot += 1) {
          if (kit.random() < 0.12) continue;
          const at = kit.ground(mapX - 1.55 + 3.1 * (lot % 2), mapY - 1.55 + 3.1 * Math.floor(lot / 2));
          const height = 0.018 + (0.035 + 0.2 * core) * kit.random() ** 1.6;
          tower(at.x, at.y - 0.012, at.z, 0.036 + kit.random() * 0.018, 0.036 + kit.random() * 0.018, height);
        }
      }
    }
  }

  // Senate Spire: the tallest thing on the island, with three halos.
  const spire = kit.ground(430, 290);
  kit.tube.add(spire.x, spire.y - 0.02, spire.z, 0.4, 0.03, 0.4, STONE);
  kit.spire.add(spire.x, spire.y, spire.z, 0.15, 0.98, 0.15, WHITE);
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * Math.PI * 2;
    kit.spire.add(spire.x + Math.cos(a) * 0.13, spire.y, spire.z + Math.sin(a) * 0.13, 0.05, 0.28, 0.05, WHITE);
  }
  for (const [at, d] of [[0.46, 0.17], [0.6, 0.13], [0.73, 0.09]] as const) kit.ring.add(spire.x, spire.y + at, spire.z, d, d, d, LAMP_WARM);
  kit.ember.add(spire.x, spire.y + 0.98, spire.z, 0.012, 0.012, 0.012, LAMP_WARM);
  kit.lamps.add({ x: spire.x, y: spire.y + 1, z: spire.z }, LAMP_WARM, 0.07, { always: true });

  // Nova Central Station: a glass hall under white ribs.
  const station = kit.ground(520, 310);
  kit.box.add(station.x, station.y - 0.02, station.z, 0.56, 0.035, 0.22, STONE);
  kit.glassVault.add(station.x, station.y + 0.015, station.z, 0.5, 0.17, 0.17, WHITE);
  for (let k = 0; k <= 6; k += 1) kit.vault.add(station.x - 0.25 + k * 0.0833, station.y + 0.015, station.z, 0.008, 0.18, 0.18, WHITE);
  for (const side of [-1, 1]) kit.box.add(station.x + side * 0.27, station.y, station.z, 0.035, 0.075, 0.2, WHITE);

  // Grand Meridian Hotel: two towers and a bridge.
  const hotel = kit.ground(620, 320);
  kit.spire.add(hotel.x - 0.045, hotel.y, hotel.z, 0.085, 0.5, 0.085, SAND);
  kit.spire.add(hotel.x + 0.045, hotel.y, hotel.z + 0.02, 0.078, 0.42, 0.078, WHITE);
  kit.box.add(hotel.x, hotel.y + 0.23, hotel.z + 0.01, 0.1, 0.014, 0.02, WHITE);

  // Starlight Plaza: a round square, a glass dome and a circle of lamps.
  const plaza = kit.ground(350, 300);
  kit.tube.add(plaza.x, plaza.y - 0.02, plaza.z, 0.44, 0.028, 0.44, STONE);
  kit.glassDome.add(plaza.x, plaza.y + 0.008, plaza.z, 0.15, 0.1, 0.15, WHITE);
  kit.ring.add(plaza.x, plaza.y + 0.012, plaza.z, 0.38, 0.38, 0.38, LAMP_WARM);
  for (let k = 0; k < 24; k += 1) {
    const a = (k / 24) * Math.PI * 2;
    kit.lamps.add({ x: plaza.x + Math.cos(a) * 0.2, y: plaza.y + 0.025, z: plaza.z + Math.sin(a) * 0.2 }, LAMP_WARM, 0.014);
    if (k % 2 === 0) tree(kit, new Vector3(plaza.x + Math.cos(a) * 0.13, plaza.y + 0.008, plaza.z + Math.sin(a) * 0.13), 0.05, GREENS);
  }

  // Delivery drones circling above the centre.
  for (let k = 0; k < 60; k += 1) {
    const g = kit.ground(380 + kit.random() * 220, 250 + kit.random() * 110);
    kit.lamps.add({ x: g.x, y: g.y + 0.15 + kit.random() * 0.4, z: g.z }, kit.random() < 0.5 ? LAMP_COOL : LAMP_WARM, 0.012, {
      always: true,
      orbit: [0.1 + kit.random() * 0.5, (kit.random() - 0.5) * 0.5],
    });
  }
}

function skyport(kit: Kit, pads: Vector3[]): void {
  const base = kit.ground(780, 380);
  const level = base.y + 0.015;
  ([[780, 380], [808, 404], [754, 412]] as const).forEach(([mapX, mapY], index) => {
    const g = kit.ground(mapX, mapY);
    const foot = Math.min(g.y, level) - 0.1;
    kit.tube.add(g.x, foot, g.z, 0.26, level - foot + 0.008, 0.26, PAD);
    kit.ring.add(g.x, level + 0.011, g.z, 0.225, 0.225, 0.225, LAMP_PAD);
    kit.ring.add(g.x, level + 0.011, g.z, 0.09, 0.09, 0.09, LAMP_COOL);
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      kit.lamps.add({ x: g.x + Math.cos(a) * 0.123, y: level + 0.016, z: g.z + Math.sin(a) * 0.123 }, LAMP_PAD, 0.02, { always: true, blink: 0.35 + index * 0.05 });
    }
    pads.push(new Vector3(g.x, level + 0.009, g.z));
  });

  // Terminal and hangars.
  const hall = kit.ground(768, 352);
  kit.vault.add(hall.x, hall.y - 0.01, hall.z, 0.36, 0.1, 0.1, WHITE, 0.3);
  kit.glassVault.add(hall.x + 0.015, hall.y - 0.01, hall.z + 0.04, 0.3, 0.07, 0.07, WHITE, 0.3);
  for (let k = 0; k < 5; k += 1) {
    const g = kit.ground(730 + k * 6, 386 + k * 6);
    kit.vault.add(g.x, g.y - 0.01, g.z, 0.1, 0.06, 0.06, k % 2 ? WHITE : SAND, 0.8);
  }

  // Control tower.
  const tower = kit.ground(800, 362);
  kit.tube.add(tower.x, tower.y - 0.01, tower.z, 0.02, 0.3, 0.02, WHITE);
  kit.tube.add(tower.x, tower.y + 0.28, tower.z, 0.06, 0.012, 0.06, WHITE);
  kit.glassDome.add(tower.x, tower.y + 0.292, tower.z, 0.055, 0.045, 0.055, WHITE);
  kit.lamps.add({ x: tower.x, y: tower.y + 0.35, z: tower.z }, LAMP_RED, 0.03, { always: true, blink: 0.6 });

  // Sky-docks: masts with arms, on the eastern shore.
  ([[848, 362], [856, 412], [838, 452]] as const).forEach(([mapX, mapY]) => {
    const g = kit.ground(mapX, mapY);
    const y = Math.max(0, g.y);
    kit.tube.add(g.x, y - 0.05, g.z, 0.018, 0.55, 0.018, WHITE);
    for (let k = 0; k < 3; k += 1) {
      const lift = y + 0.16 + k * 0.12;
      const turn = k * 2.1 + mapX;
      kit.box.add(g.x + Math.cos(turn) * 0.055, lift, g.z - Math.sin(turn) * 0.055, 0.12, 0.008, 0.018, SAND, turn);
      kit.lamps.add({ x: g.x + Math.cos(turn) * 0.11, y: lift + 0.014, z: g.z - Math.sin(turn) * 0.11 }, LAMP_COOL, 0.02, { always: true });
    }
    kit.lamps.add({ x: g.x, y: y + 0.51, z: g.z }, LAMP_RED, 0.026, { always: true, blink: 0.45 });
  });

  // Zenith Skyhotel: a needle with a terrace in the sky.
  const zenith = kit.ground(760, 460);
  kit.tube.add(zenith.x, zenith.y - 0.02, zenith.z, 0.04, 0.6, 0.04, WHITE);
  kit.tube.add(zenith.x, zenith.y + 0.55, zenith.z, 0.15, 0.016, 0.15, WHITE);
  kit.glassDome.add(zenith.x, zenith.y + 0.566, zenith.z, 0.12, 0.07, 0.12, WHITE);
  kit.ring.add(zenith.x, zenith.y + 0.558, zenith.z, 0.16, 0.16, 0.16, LAMP_WARM);

  pods(kit, 830, 330, 6, 18, 0.06);
  scatter(kit, Z.SKYPORT, 190, (x, y) => Math.hypot(x - 780, y - 395) > 26 && Math.hypot(x - 780, y - 395) < 110, (g) => {
    const h = 0.014 + kit.random() ** 2 * 0.07;
    if (kit.random() < 0.6) kit.box.add(g.x, g.y - 0.01, g.z, 0.03 + kit.random() * 0.03, h, 0.03 + kit.random() * 0.03, kit.pick(TOWERS), 0.5);
    else kit.dome.add(g.x, g.y - 0.004, g.z, 0.04, 0.018 + h * 0.3, 0.04, WHITE);
  });
  scatter(kit, Z.SKYPORT, 520, () => true, (g) => tree(kit, g, 0.04 + kit.random() * 0.03, GREENS));
  // Beacons on the islets.
  ([[958, 335], [942, 468], [905, 552]] as const).forEach(([mapX, mapY]) => {
    const g = kit.ground(mapX, mapY);
    kit.tube.add(g.x, g.y - 0.02, g.z, 0.015, 0.14, 0.015, WHITE);
    kit.lamps.add({ x: g.x, y: g.y + 0.125, z: g.z }, LAMP_WARM, 0.05, { always: true, blink: 0.25 });
  });
}

function sunkenDelta(kit: Kit): void {
  // Coral Harbor: piers into the bay, boats alongside.
  const quay = toWorld(196, 436);
  for (let k = 0; k < 6; k += 1) {
    const turn = 1.2 + k * 0.26;
    const start = new Vector3(quay.x + (k - 2.5) * 0.08, 0.012, quay.z + 0.02);
    const length = 0.4 + kit.random() * 0.3;
    const end = new Vector3(start.x - Math.cos(turn) * length, 0.012, start.z + Math.sin(turn) * length);
    kit.box.add((start.x + end.x) / 2, 0.004, (start.z + end.z) / 2, length, 0.008, 0.012, STONE, turn);
    for (let b = 0; b < 6; b += 1) {
      const f = 0.2 + b * 0.14;
      const side = b % 2 ? 0.016 : -0.016;
      const x = start.x + (end.x - start.x) * f + Math.sin(turn) * side;
      const z = start.z + (end.z - start.z) * f + Math.cos(turn) * side;
      kit.ball.add(x, -0.002, z, 0.03, 0.008, 0.01, kit.random() < 0.6 ? WHITE : kit.pick(AWNINGS), turn + 1.57);
    }
    kit.lamps.add({ x: end.x, y: 0.03, z: end.z }, LAMP_WARM, 0.022);
  }
  for (let k = 0; k < 5; k += 1) {
    const g = kit.ground(204 + k * 6, 420 - k * 2);
    kit.vault.add(g.x, g.y - 0.01, g.z, 0.1, 0.05, 0.05, k % 2 ? SAND : WHITE, 0.4);
  }
  for (const [mapX, mapY] of [[188, 430], [214, 432]] as const) {
    const g = kit.ground(mapX, mapY);
    kit.box.add(g.x, g.y, g.z, 0.008, 0.1, 0.008, tone("#d9772b"));
    kit.box.add(g.x - 0.025, g.y + 0.095, g.z, 0.08, 0.006, 0.006, tone("#d9772b"));
  }

  // Tidewalk Bazaar: a spiral of awnings.
  for (let k = 0; k < 80; k += 1) {
    const a = k * 0.62;
    const r = 1.2 + k * 0.17;
    const g = kit.ground(300 + Math.cos(a) * r, 400 + Math.sin(a) * r);
    if (g.y < 0.02) continue;
    kit.cone.add(g.x, g.y + 0.002, g.z, 0.02, 0.009, 0.02, kit.pick(AWNINGS), a);
    if (k % 3 === 0) kit.lamps.add({ x: g.x, y: g.y + 0.016, z: g.z }, LAMP_WARM, 0.014);
  }

  // Mangrove Hotel and the stilt houses along the channels.
  pods(kit, 150, 380, 8, 14, 0.06);
  scatter(kit, Z.DELTA, 240, (x, y) => waterwayAt(x, y) > 0.01 && waterwayAt(x, y) < 0.35, (g) => {
    const s = 0.016 + kit.random() * 0.012;
    kit.hex.add(g.x, g.y - 0.02, g.z, 0.003, 0.034, 0.003, STONE);
    kit.dome.add(g.x, g.y + 0.012, g.z, s, s * 0.6, s, kit.random() < 0.7 ? WHITE : kit.pick(AWNINGS));
    kit.lamps.add({ x: g.x, y: g.y + 0.03, z: g.z }, LAMP_WARM, 0.011);
  });
  scatter(kit, Z.DELTA, 2000, (x, y) => waterwayAt(x, y) < 0.6, (g) => tree(kit, g, 0.035 + kit.random() * 0.035, GREENS));
}

function crystalReach(kit: Kit): void {
  scatter(kit, Z.CRYSTAL, 64, (_x, _y, g) => g.y > 0.25, (g, mapX, mapY) => {
    const shards = 5 + Math.floor(kit.random() * 6);
    const tint = kit.pick(CRYSTALS);
    for (let k = 0; k < shards; k += 1) {
      const at = kit.ground(mapX + (kit.random() - 0.5) * 4, mapY + (kit.random() - 0.5) * 4);
      const h = 0.03 + kit.random() * 0.14 * (k === 0 ? 1.5 : 0.8);
      kit.shard.add(at.x, at.y - 0.015, at.z, h * 0.24, h, h * 0.24, tint, kit.random() * 6.28, (kit.random() - 0.5) * 0.7, (kit.random() - 0.5) * 0.7);
    }
    kit.lamps.add({ x: g.x, y: g.y + 0.06, z: g.z }, tint, 0.03);
  });

  // A field of crystals around the observatory.
  for (let k = 0; k < 90; k += 1) {
    const a = kit.random() * 6.28;
    const r = 5 + kit.random() * 30;
    const at = kit.ground(204 + Math.cos(a) * r, 206 + Math.sin(a) * r);
    if (at.y < 0.2) continue;
    const h = 0.03 + kit.random() ** 2 * 0.16;
    kit.shard.add(at.x, at.y - 0.012, at.z, h * 0.24, h, h * 0.24, kit.pick(CRYSTALS), kit.random() * 6.28, (kit.random() - 0.5) * 0.6, (kit.random() - 0.5) * 0.6);
  }

  // Prism Observatory: a white dome, two dishes and the great prism.
  const g = kit.ground(200, 200);
  kit.tube.add(g.x, g.y - 0.04, g.z, 0.14, 0.085, 0.14, WHITE);
  kit.dome.add(g.x, g.y + 0.045, g.z, 0.135, 0.085, 0.135, WHITE);
  kit.shard.add(g.x + 0.13, g.y - 0.03, g.z + 0.03, 0.075, 0.38, 0.075, CRYSTALS[1] ?? WHITE, 0.4, 0.08, -0.1);
  for (const side of [-1, 1]) {
    const dish = kit.ground(200 + side * 6, 206);
    kit.hex.add(dish.x, dish.y - 0.01, dish.z, 0.006, 0.045, 0.006, WHITE);
    kit.dome.add(dish.x, dish.y + 0.066, dish.z, 0.06, 0.02, 0.06, WHITE, 0, Math.PI - 0.5, side * 0.3);
  }
  kit.lamps.add({ x: g.x, y: g.y + 0.14, z: g.z }, LAMP_COOL, 0.03, { always: true, blink: 0.2 });
  pods(kit, 160, 270, 5, 10);
  pods(kit, 260, 260, 5, 10);
  scatter(kit, Z.CRYSTAL, 520, (_x, _y, ground) => ground.y < 0.9, (ground) => (kit.random() < 0.45 ? pine(kit, ground, 0.04 + kit.random() * 0.03) : tree(kit, ground, 0.035 + kit.random() * 0.03, kit.random() < 0.2 ? EXOTIC : GREENS)));
}

function verdantBasin(kit: Kit): void {
  const forest = (g: Vector3) => kit.noise.sample(g.x * 0.083, g.z * 0.083, 3) > 0.53;
  scatter(kit, Z.VERDANT, 5200, (x, y, g) => forest(g) && waterwayAt(x, y) < 0.05, (g) => {
    tree(kit, g, 0.045 + kit.random() * 0.05, kit.random() < 0.1 ? EXOTIC : GREENS);
  });
  scatter(kit, Z.VERDANT, 90, (x, y, g) => !forest(g) && waterwayAt(x, y) < 0.02, (g) => {
    kit.dome.add(g.x, g.y - 0.004, g.z, 0.028, 0.016, 0.028, WHITE);
    kit.tube.add(g.x + 0.024, g.y - 0.01, g.z, 0.01, 0.034, 0.01, SAND);
    kit.dome.add(g.x + 0.024, g.y + 0.024, g.z, 0.01, 0.006, 0.01, SAND);
    kit.lamps.add({ x: g.x, y: g.y + 0.02, z: g.z }, LAMP_WARM, 0.012);
  });

  // Fernwell Gardens: a biodome with its own grove.
  const gardens = kit.ground(380, 130);
  kit.tube.add(gardens.x, gardens.y - 0.03, gardens.z, 0.3, 0.036, 0.3, STONE);
  kit.glassDome.add(gardens.x, gardens.y + 0.006, gardens.z, 0.28, 0.17, 0.28, WHITE);
  for (let k = 0; k < 14; k += 1) {
    const a = k * 2.4;
    const r = 0.02 + (k % 4) * 0.027;
    tree(kit, new Vector3(gardens.x + Math.cos(a) * r, gardens.y + 0.008, gardens.z + Math.sin(a) * r), 0.07 + (k % 3) * 0.02, k % 4 === 0 ? EXOTIC : GREENS);
  }
  for (const [dx, dz, d] of [[0.2, 0.06, 0.12], [-0.16, 0.15, 0.09]] as const) {
    kit.glassDome.add(gardens.x + dx, gardens.y, gardens.z + dz, d, d * 0.55, d, WHITE);
    tree(kit, new Vector3(gardens.x + dx, gardens.y, gardens.z + dz), d * 0.8, GREENS);
  }

  // Greenhouses in rows, and Greenroot Market.
  for (let row = 0; row < 6; row += 1) {
    for (let k = 0; k < 8; k += 1) {
      const g = kit.ground(452 + k * 4.2, 138 + row * 2.4);
      if (g.y > 0.03) kit.glassVault.add(g.x, g.y - 0.003, g.z, 0.07, 0.022, 0.022, WHITE);
    }
  }
  for (let k = 0; k < 44; k += 1) {
    const g = kit.ground(420 + (kit.random() - 0.5) * 9, 170 + (kit.random() - 0.5) * 7);
    kit.cone.add(g.x, g.y + 0.002, g.z, 0.02, 0.009, 0.02, kit.pick(AWNINGS), kit.random() * 3);
    if (k % 2 === 0) kit.lamps.add({ x: g.x, y: g.y + 0.016, z: g.z }, LAMP_WARM, 0.014);
  }
  pods(kit, 500, 200, 5, 8);
}

function emberWastes(kit: Kit): void {
  // Forges: dark halls with glowing chimneys.
  ([[652, 176], [676, 214], [700, 162], [742, 214], [612, 206], [664, 196], [730, 172]] as const).forEach(([mapX, mapY]) => {
    const g = kit.ground(mapX, mapY);
    const turn = kit.random() * 3;
    kit.box.add(g.x, g.y - 0.02, g.z, 0.12, 0.05, 0.08, IRON, turn);
    kit.ember.add(g.x, g.y + 0.01, g.z, 0.123, 0.004, 0.03, LAMP_LAVA, turn);
    for (let k = 0; k < 3; k += 1) {
      const x = g.x + (k - 1) * 0.035;
      const h = 0.12 + kit.random() * 0.09;
      kit.tube.add(x, g.y, g.z + 0.03, 0.012, h, 0.012, IRON);
      kit.ember.add(x, g.y + h, g.z + 0.03, 0.011, 0.005, 0.011, LAMP_LAVA);
      kit.lamps.add({ x, y: g.y + h + 0.01, z: g.z + 0.03 }, LAMP_LAVA, 0.035, { always: true });
    }
  });

  // Magma Forge Museum: a dark ziggurat with fire at the top.
  const museum = kit.ground(720, 190);
  for (let k = 0; k < 5; k += 1) {
    const s = 0.24 - k * 0.042;
    kit.box.add(museum.x, museum.y - 0.02 + k * 0.032, museum.z, s, 0.036, s, k % 2 ? IRON : BASALT, 0.4);
    if (k > 0) kit.ember.add(museum.x, museum.y - 0.019 + k * 0.032, museum.z, s * 1.004, 0.0016, s * 1.004, LAMP_LAVA, 0.4);
  }
  kit.ember.add(museum.x, museum.y + 0.145, museum.z, 0.03, 0.03, 0.03, LAMP_LAVA, 0.4);
  kit.lamps.add({ x: museum.x, y: museum.y + 0.18, z: museum.z }, LAMP_LAVA, 0.09, { always: true });

  for (let k = 0; k < 26; k += 1) {
    const g = kit.ground(600 + (kit.random() - 0.5) * 12, 160 + (kit.random() - 0.5) * 9);
    kit.cone.add(g.x, g.y - 0.003, g.z, 0.02, 0.018, 0.02, kit.random() < 0.5 ? SAND : CLAY, kit.random() * 3);
    if (k % 2 === 0) kit.lamps.add({ x: g.x, y: g.y + 0.016, z: g.z }, LAMP_WARM, 0.013);
  }
  pods(kit, 640, 190, 5, 8);
  scatter(kit, Z.EMBER, 320, () => true, (g) => {
    const h = 0.012 + kit.random() * 0.045;
    kit.hex.add(g.x, g.y - 0.01, g.z, 0.012 + kit.random() * 0.02, h, 0.012 + kit.random() * 0.02, BASALT, kit.random() * 3, (kit.random() - 0.5) * 0.3, (kit.random() - 0.5) * 0.3);
  });
}

function frostpeak(kit: Kit): void {
  const station = kit.ground(800, 190);
  for (const [dx, dz, d] of [[0, 0, 0.1], [0.075, 0.03, 0.065], [-0.06, 0.05, 0.07]] as const) {
    const g = kit.ground(800 + dx / 0.02, 190 + dz / 0.02);
    kit.tube.add(g.x, g.y - 0.08, g.z, d, 0.1, d, WHITE);
    kit.dome.add(g.x, g.y + 0.02, g.z, d, d * 0.5, d, WHITE);
  }
  kit.glassDome.add(station.x + 0.015, station.y + 0.07, station.z - 0.065, 0.06, 0.04, 0.06, WHITE);
  kit.tube.add(station.x - 0.03, station.y, station.z - 0.03, 0.007, 0.2, 0.007, WHITE);
  kit.lamps.add({ x: station.x - 0.03, y: station.y + 0.21, z: station.z - 0.03 }, LAMP_RED, 0.03, { always: true, blink: 0.5 });

  // The gondola from the foothills up to Glacier Station.
  let previous: Vector3 | null = null;
  for (let k = 0; k <= 14; k += 1) {
    const f = k / 14;
    const g = kit.ground(742 + (800 - 742) * f, 300 + (196 - 300) * f);
    const top = new Vector3(g.x, g.y + 0.07, g.z);
    kit.hex.span(g.clone().setY(g.y - 0.02), top, 0.005, WHITE);
    kit.lamps.add(top, LAMP_COOL, 0.014);
    if (previous) kit.hex.span(previous, top, 0.002, SLATE);
    previous = top;
  }

  for (const [mapX, mapY] of [[825, 225], [840, 260]] as const) {
    for (let k = 0; k < 6; k += 1) {
      const g = kit.ground(mapX + (kit.random() - 0.5) * 7, mapY + (kit.random() - 0.5) * 7);
      kit.cone.add(g.x, g.y - 0.008, g.z, 0.03, 0.036, 0.03, k % 2 ? CLAY : WHITE, kit.random() * 3);
      kit.lamps.add({ x: g.x, y: g.y + 0.014, z: g.z + 0.016 }, LAMP_WARM, 0.014);
    }
  }
  scatter(kit, Z.FROST, 900, (_x, _y, g) => g.y < 0.85, (g) => pine(kit, g, 0.04 + kit.random() * 0.035));
}

function obsidianCoast(kit: Kit): void {
  // Basalt columns, in organ-pipe clusters near the shore.
  scatter(kit, Z.OBSIDIAN, 110, (_x, _y, g) => g.y < 0.2, (_g, mapX, mapY) => {
    const columns = 9 + Math.floor(kit.random() * 14);
    for (let k = 0; k < columns; k += 1) {
      const at = kit.ground(mapX + (k % 5) * 0.6 + kit.random() * 0.2, mapY + Math.floor(k / 5) * 0.55 + kit.random() * 0.2);
      const h = 0.025 + kit.random() * 0.085;
      kit.hex.add(at.x, Math.max(-0.02, at.y - 0.02), at.z, 0.0125, h, 0.0125, BASALT);
    }
  });

  // Obsidian Spa Resort: white domes around pools that glow at night.
  for (let k = 0; k < 7; k += 1) {
    const a = k * 0.9;
    const g = kit.ground(600 + Math.cos(a) * 5, 480 + Math.sin(a) * 4.5);
    const d = 0.055 + (k % 3) * 0.015;
    kit.dome.add(g.x, g.y - 0.004, g.z, d, d * 0.5, d, WHITE);
    const pool = kit.ground(600 + Math.cos(a + 0.45) * 2.2, 480 + Math.sin(a + 0.45) * 2.2);
    kit.pool.add(pool.x, pool.y + 0.003, pool.z, 0.035, 0.003, 0.035, LAMP_POOL);
  }
  pods(kit, 520, 440, 6, 10);
  for (let k = 0; k < 34; k += 1) {
    const g = kit.ground(432 + k * 1.2, 492 + Math.sin(k) * 2);
    if (g.y > 0.012 && g.y < 0.12) kit.cone.add(g.x, g.y + 0.008, g.z, 0.012, 0.005, 0.012, kit.pick(AWNINGS));
  }
  scatter(kit, Z.OBSIDIAN, 460, () => true, (g) => tree(kit, g, 0.035 + kit.random() * 0.03, kit.random() < 0.35 ? EXOTIC : GREENS));
}

/** An elevated maglev loop: the track, its pylons and lamps; returns the points trains follow. */
function maglev(kit: Kit, stops: readonly (readonly [number, number])[]): Vector3[] {
  const curve = new CatmullRomCurve3(
    stops.map(([mapX, mapY]) => {
      const world = toWorld(mapX, mapY);
      return new Vector3(world.x, 0, world.z);
    }),
    true,
    "centripetal",
  );
  const points = curve.getSpacedPoints(420);
  points.pop();
  const lift = points.map((p) => Math.max(0, kit.terrain.heightAt(p.x / 0.02 + 500, p.z / 0.02 + 320)) + 0.034);
  const count = points.length;
  // The deck never dips below its supports: raise the hollows, keep the crests.
  for (let pass = 0; pass < 30; pass += 1) {
    for (let i = 0; i < count; i += 1) {
      const average = ((lift[(i + count - 1) % count] ?? 0) + (lift[(i + 1) % count] ?? 0)) / 2;
      lift[i] = Math.max(lift[i] ?? 0, average);
    }
  }
  points.forEach((p, i) => p.setY(lift[i] ?? 0));
  points.forEach((p, i) => {
    const next = points[(i + 1) % count] ?? p;
    kit.hex.span(p, next, 0.0065, WHITE);
    if (i % 5 === 0) {
      const base = Math.max(-0.05, kit.terrain.heightAt(p.x / 0.02 + 500, p.z / 0.02 + 320)) - 0.02;
      kit.hex.span(new Vector3(p.x, base, p.z), new Vector3(p.x, p.y - 0.002, p.z), 0.0045, STONE);
    }
    if (i % 3 === 0) kit.lamps.add({ x: p.x, y: p.y + 0.007, z: p.z }, LAMP_COOL, 0.013);
  });
  return points;
}

export interface WorldCity {
  readonly group: Group;
  update(time: number): void;
  /** Screen pixels covered by one world unit at distance 1, so lamps keep their size. */
  setPixels(value: number): void;
  dispose(): void;
}

const CARS = 5;
const TRAINS_PER_LINE = 3;

export function buildCity(terrain: WorldTerrain, atmosphere: Atmosphere, noise: NoiseField): WorldCity {
  const group = new Group();
  const random = seeded(2140);

  const hull = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, metalness: 0 });
  patchStandard(hull, atmosphere, {
    key: "hull",
    vertexPars: WINDOWS_VERTEX_PARS,
    vertex: WINDOWS_VERTEX,
    fragmentPars: WINDOWS_PARS,
    color: WINDOWS_COLOR,
    roughness: "roughnessFactor = mix(roughnessFactor, 0.08, tnPane);",
    reflect: 0.9,
  });
  const glass = new MeshStandardMaterial({ color: "#bfe6ee", roughness: 0.06, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false });
  patchStandard(glass, atmosphere, {
    key: "glass",
    color: "totalEmissiveRadiance += tnC(1.0, 0.82, 0.55) * uLights * 0.5;\ndiffuseColor.a = mix(diffuseColor.a, 0.55, uLights);",
    reflect: 1.3,
    glass: true,
  });
  // Leaves: clumps of light and dark, a dim underside, a rough surface, and a glow when the sun is behind.
  const foliage = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, metalness: 0 });
  patchStandard(foliage, atmosphere, {
    key: "foliage",
    vertexPars: "varying float vTnCrown;",
    vertex: "vTnCrown = position.y;",
    fragmentPars: "varying float vTnCrown;\nvec2 tnLeaf;",
    color: `
      float tnClump = texture2D(uNoise, vTnWorld.xz * 2.3).a;
      vec4 tnFine = texture2D(uNoise, vTnWorld.xz * 13.0 + vTnWorld.y * 9.0);
      tnLeaf = tnFine.gb - 0.5;
      diffuseColor.rgb *= (0.5 + 0.62 * tnFine.r + 0.5 * (tnClump - 0.5)) * mix(0.42, 1.12, smoothstep(-0.05, 0.85, vTnCrown));
      float tnBack = max(0.0, dot(normalize(vTnWorld - cameraPosition), uLightDir));
      totalEmissiveRadiance += diffuseColor.rgb * uLightColor * tnBack * tnBack * 0.07;`,
    normal: "normal = normalize(normal + vec3(tnLeaf.x, tnLeaf.y * 0.5, tnLeaf.y) * 1.3);",
    reflect: 0,
  });
  const crystal = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.14, metalness: 0, flatShading: true });
  patchStandard(crystal, atmosphere, {
    key: "crystal",
    color: "totalEmissiveRadiance += diffuseColor.rgb * (0.22 + 1.5 * uLights);\ndiffuseColor.rgb *= 0.7;",
    reflect: 1.6,
  });
  const glowMaterial = (base: number) =>
    new ShaderMaterial({ vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT, uniforms: { ...atmosphere.uniforms, uBase: { value: base } } });
  const nightGlow = glowMaterial(0.05);
  const alwaysGlow = glowMaterial(0.3);
  const pixels = { value: 800 };
  const lampMaterial = new ShaderMaterial({
    vertexShader: LAMP_VERTEX,
    fragmentShader: LAMP_FRAGMENT,
    uniforms: { ...atmosphere.uniforms, uPixels: pixels },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const geometries = {
    box: unit(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), false),
    tube: unit(new CylinderGeometry(0.5, 0.5, 1, 24).translate(0, 0.5, 0), true),
    hex: unit(new CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0), true),
    cone: unit(new ConeGeometry(0.5, 1, 20).translate(0, 0.5, 0), true),
    dome: unit(new SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2, 1), true),
    ball: unit(new SphereGeometry(0.5, 16, 10).translate(0, 0.5, 0), true),
    // An organic tower: wide foot, slim waist, a bulb under the tip.
    spire: unit(
      new LatheGeometry(
        ([[0.5, 0], [0.4, 0.05], [0.29, 0.18], [0.22, 0.42], [0.2, 0.62], [0.25, 0.74], [0.17, 0.83], [0.07, 0.9], [0.02, 1], [0, 1]] as const).map(([r, y]) => new Vector2(r, y)),
        20,
      ),
      true,
    ),
    vault: unit(new CylinderGeometry(0.5, 0.5, 1, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), true),
    ring: new TorusGeometry(0.5, 0.012, 6, 56).rotateX(Math.PI / 2),
    tree: crownGeometry(),
    pine: mergeGeometries([new ConeGeometry(0.5, 0.62, 7).translate(0, 0.36, 0), new ConeGeometry(0.36, 0.5, 7).translate(0, 0.72, 0)]),
    shard: new ConeGeometry(0.5, 1, 5).translate(0, 0.5, 0),
  };

  const kit: Kit = {
    terrain,
    noise,
    random,
    box: new Batch(geometries.box, hull),
    tube: new Batch(geometries.tube, hull),
    hex: new Batch(geometries.hex, hull),
    cone: new Batch(geometries.cone, hull),
    dome: new Batch(geometries.dome, hull),
    ball: new Batch(geometries.ball, hull),
    spire: new Batch(geometries.spire, hull),
    vault: new Batch(geometries.vault, hull),
    glassDome: new Batch(geometries.dome, glass, false, 1),
    glassVault: new Batch(geometries.vault, glass, false, 1),
    ring: new Batch(geometries.ring, nightGlow, false),
    pool: new Batch(geometries.tube, nightGlow, false),
    ember: new Batch(geometries.box, alwaysGlow, false),
    tree: new Batch(geometries.tree, foliage, false),
    pine: new Batch(geometries.pine, foliage, false),
    shard: new Batch(geometries.shard, crystal),
    lamps: new Lamps(),
    ground(mapX, mapY) {
      const world = toWorld(mapX, mapY);
      return new Vector3(world.x, terrain.heightAt(mapX, mapY), world.z);
    },
    pick(list) {
      return list[Math.floor(random() * list.length)] as (typeof list)[number];
    },
  };

  const pads: Vector3[] = [];
  novaPrime(kit);
  skyport(kit, pads);
  sunkenDelta(kit);
  crystalReach(kit);
  verdantBasin(kit);
  emberWastes(kit);
  frostpeak(kit);
  obsidianCoast(kit);
  const lines = [
    maglev(kit, [[780, 394], [622, 334], [520, 324], [432, 304], [352, 314], [300, 404], [450, 478], [600, 468], [752, 450]]),
    maglev(kit, [[520, 296], [426, 182], [600, 168], [712, 202], [770, 264], [824, 340], [792, 368], [630, 308]]),
  ];

  for (const batch of [kit.box, kit.tube, kit.hex, kit.cone, kit.dome, kit.ball, kit.spire, kit.vault, kit.tree, kit.pine, kit.shard, kit.ring, kit.pool, kit.ember, kit.glassDome, kit.glassVault]) {
    const mesh = batch.build();
    if (mesh) group.add(mesh);
  }
  const lampGeometry = kit.lamps.geometry();
  const lamps = new Points(lampGeometry, lampMaterial);
  lamps.frustumCulled = false;
  lamps.renderOrder = 4;
  group.add(lamps);

  // Trains and shuttles move: their matrices and lights are rewritten every frame.
  const trainCount = lines.length * TRAINS_PER_LINE * CARS;
  const trains = new InstancedMesh(geometries.ball, hull, trainCount);
  trains.frustumCulled = false;
  trains.castShadow = true;
  const shuttles = new InstancedMesh(geometries.spire, hull, pads.length);
  shuttles.frustumCulled = false;
  shuttles.castShadow = true;
  for (let i = 0; i < trainCount; i += 1) trains.setColorAt(i, WHITE);
  for (let i = 0; i < pads.length; i += 1) shuttles.setColorAt(i, WHITE);
  const moving = new Lamps();
  for (let i = 0; i < lines.length * TRAINS_PER_LINE; i += 1) moving.add({ x: 0, y: 0, z: 0 }, LAMP_COOL, 0.03, { always: true });
  for (let i = 0; i < pads.length; i += 1) moving.add({ x: 0, y: 0, z: 0 }, LAMP_PAD, 0.11, { always: true });
  const movingGeometry = moving.geometry(true);
  const movingLamps = new Points(movingGeometry, lampMaterial);
  movingLamps.frustumCulled = false;
  movingLamps.renderOrder = 4;
  group.add(trains, shuttles, movingLamps);

  const at = new Vector3();
  const ahead = new Vector3();
  const along = (line: Vector3[], u: number, target: Vector3): Vector3 => {
    const f = (((u % 1) + 1) % 1) * line.length;
    const i = Math.floor(f);
    const a = line[i % line.length] ?? target;
    const b = line[(i + 1) % line.length] ?? target;
    return target.copy(a).lerp(b, f - i);
  };

  return {
    group,
    update(time) {
      const lights = movingGeometry.getAttribute("position") as BufferAttribute;
      let car = 0;
      lines.forEach((line, lineIndex) => {
        for (let train = 0; train < TRAINS_PER_LINE; train += 1) {
          const head = time * 0.0065 * (lineIndex ? -1 : 1) + train / TRAINS_PER_LINE + lineIndex * 0.13;
          for (let k = 0; k < CARS; k += 1) {
            const u = head - k * 0.0021 * (lineIndex ? -1 : 1);
            along(line, u, at);
            along(line, u + 0.002, ahead).sub(at).normalize();
            _matrix.compose(_position.set(at.x, at.y + 0.003, at.z), _quaternion.setFromUnitVectors(AHEAD, ahead), _scale.set(0.036, 0.011, 0.012));
            trains.setMatrixAt(car, _matrix);
            if (k === 0) lights.setXYZ(lineIndex * TRAINS_PER_LINE + train, at.x, at.y + 0.012, at.z);
            car += 1;
          }
        }
      });
      // Shuttles: up through the clouds, a pause out of sight, then back down.
      pads.forEach((pad, index) => {
        const cycle = (time / 46 + index / pads.length) % 1;
        const leg = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
        const climb = Math.max(0, leg * 1.5 - 0.25) / 1.25;
        const height = climb * climb * 7;
        const drift = climb * climb * (index - 1) * 1.6;
        _matrix.compose(_position.set(pad.x + drift, pad.y + height, pad.z - drift * 0.4), _quaternion.identity(), _scale.set(0.036, 0.13, 0.036));
        shuttles.setMatrixAt(index, _matrix);
        lights.setXYZ(lines.length * TRAINS_PER_LINE + index, pad.x + drift, pad.y + height - 0.02 - (height > 0.001 ? 0.03 : 10), pad.z - drift * 0.4);
      });
      trains.instanceMatrix.needsUpdate = true;
      shuttles.instanceMatrix.needsUpdate = true;
      lights.needsUpdate = true;
    },
    setPixels(value) {
      pixels.value = value;
    },
    dispose() {
      for (const geometry of Object.values(geometries)) geometry.dispose();
      for (const material of [hull, glass, foliage, crystal, nightGlow, alwaysGlow, lampMaterial]) material.dispose();
      lampGeometry.dispose();
      movingGeometry.dispose();
      trains.dispose();
      shuttles.dispose();
    },
  };
}
