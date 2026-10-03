import { BufferAttribute, Color, PlaneGeometry } from "three";

import { ZONE_TERRAIN } from "@/modules/alerts/city-map-data";
import { CITY_ZONES, CITY_ZONE_IDS, CITY_ZONE_VERTICES, zoneAt, type CityZoneId } from "@/modules/alerts/city-zones";

/**
 * Procedural relief for the Terra Nova map. The zone polygons of the city map
 * (a 1000 × 640 plane) decide which terrain profile applies where; noise adds
 * ridges and dunes, a blur pass melts the borders between zones, and the
 * island's outline sinks into the sea along a noisy coast.
 */

export const MAP_W = 1000;
export const MAP_H = 640;
/** World units per map unit. */
export const MAP_SCALE = 0.02;
/** World height per map height unit. */
export const HEIGHT_SCALE = 0.02;

export function toWorld(x: number, y: number): { x: number; z: number } {
  return { x: (x - MAP_W / 2) * MAP_SCALE, z: (y - MAP_H / 2) * MAP_SCALE };
}

export function toMap(worldX: number, worldZ: number): { x: number; y: number } {
  return { x: worldX / MAP_SCALE + MAP_W / 2, y: worldZ / MAP_SCALE + MAP_H / 2 };
}

/** Outer coastline of the island, in order around it. */
const COAST = (["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const).map((key) => CITY_ZONE_VERTICES[key]);

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, octaves = 5): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

/** Ridged noise: sharp crests, for mountains. */
function ridged(x: number, y: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < 5; i += 1) {
    const n = 1 - Math.abs(valueNoise(x * frequency, y * frequency) * 2 - 1);
    value += amplitude * n * n;
    frequency *= 2.1;
    amplitude *= 0.5;
  }
  return value;
}

function insideCoast(x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i, i += 1) {
    const [xi, yi] = COAST[i] ?? [0, 0];
    const [xj, yj] = COAST[j] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Signed distance to the coastline in map units: positive inland, negative at sea. */
function coastDistance(x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i, i += 1) {
    const [ax, ay] = COAST[j] ?? [0, 0];
    const [bx, by] = COAST[i] ?? [0, 0];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return insideCoast(x, y) ? best : -best;
}

function blur(values: Float32Array, columns: number, rows: number, radius: number, passes: number): void {
  const temp = new Float32Array(values.length);
  for (let pass = 0; pass < passes; pass += 1) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        let sum = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const cc = Math.min(columns - 1, Math.max(0, c + k));
          sum += values[r * columns + cc] ?? 0;
          count += 1;
        }
        temp[r * columns + c] = sum / count;
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        let sum = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const rr = Math.min(rows - 1, Math.max(0, r + k));
          sum += temp[rr * columns + c] ?? 0;
          count += 1;
        }
        values[r * columns + c] = sum / count;
      }
    }
  }
}

export interface TerrainResult {
  readonly geometry: PlaneGeometry;
  /** Height in world units at any map point (bilinear on the grid). */
  readonly heightAt: (x: number, y: number) => number;
}

const SAND = new Color("#a89a7c");
const WET = new Color("#3b4a44");
const SNOW = new Color("#f4f7f9");

export function buildTerrain(segmentsX = 300, segmentsY = 210): TerrainResult {
  const margin = 170;
  const width = (MAP_W + margin * 2) * MAP_SCALE;
  const height = (MAP_H + margin * 2) * MAP_SCALE;
  const geometry = new PlaneGeometry(width, height, segmentsX, segmentsY);
  geometry.rotateX(-Math.PI / 2);
  const columns = segmentsX + 1;
  const rows = segmentsY + 1;
  const count = columns * rows;
  const position = geometry.getAttribute("position") as BufferAttribute;

  const zoneIndex = new Int8Array(count);
  const heights = new Float32Array(count);
  const coast = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const { x, y } = toMap(position.getX(i), position.getZ(i));
    // Bays and capes at two scales, so the coast never follows the straight district edges.
    const ripple = (fbm(x / 110, y / 110, 4) - 0.5) * 90 + (fbm(x / 28 + 9, y / 28 + 4, 3) - 0.5) * 26;
    const d = coastDistance(x, y) + ripple;
    coast[i] = d;
    const zone = d > 0 ? (zoneAt(x, y) ?? nearestZone(x, y)) : null;
    zoneIndex[i] = zone ? CITY_ZONE_IDS.indexOf(zone) : -1;
    if (!zone) {
      heights[i] = -6 + Math.max(-30, d * 0.12) + fbm(x / 40, y / 40, 3) * 3;
      continue;
    }
    const profile = ZONE_TERRAIN[zone];
    const n = fbm((x / 90) * profile.rough, (y / 90) * profile.rough);
    const r = ridged((x / 120) * profile.rough + 7.1, (y / 120) * profile.rough + 3.7);
    heights[i] = profile.base + profile.relief * (n * (1 - profile.ridge) + r * profile.ridge);
  }

  blur(heights, columns, rows, 3, 2);

  const colors = new Float32Array(count * 3);
  const color = new Color();
  for (let i = 0; i < count; i += 1) {
    const d = coast[i] ?? 0;
    const land = Math.min(1, Math.max(0, d / 70));
    // Land slopes gently down to a beach, then a shelf under the water.
    let h = (heights[i] ?? 0) * (0.04 + 0.96 * land * land * (3 - 2 * land)) + Math.min(1, d / 8) * 0.6;
    if (d <= 0) h = Math.min(h, -1.5 + d * 0.06);
    heights[i] = h;
    position.setY(i, h * HEIGHT_SCALE);

    const index = zoneIndex[i] ?? -1;
    if (index < 0) {
      color.copy(WET);
    } else {
      const zone = CITY_ZONE_IDS[index] as CityZoneId;
      const profile = ZONE_TERRAIN[zone];
      const t = Math.min(1, Math.max(0, (h - profile.base) / Math.max(1, profile.relief)));
      color.set(profile.low).lerp(new Color(profile.high), t);
      if (d < 9) color.lerp(SAND, 1 - d / 9);
      if (h > 46) color.lerp(SNOW, Math.min(1, (h - 46) / 16));
      const grain = (hash(i * 0.37, i * 0.11) - 0.5) * 0.06;
      color.offsetHSL(0, 0, grain);
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("aZone", new BufferAttribute(new Float32Array(zoneIndex), 1));
  geometry.setAttribute("aTint", new BufferAttribute(new Float32Array(count * 4), 4));
  geometry.computeVertexNormals();

  const stepX = width / segmentsX;
  const stepZ = height / segmentsY;
  const heightAt = (x: number, y: number): number => {
    const world = toWorld(x, y);
    const gx = (world.x + width / 2) / stepX;
    const gz = (world.z + height / 2) / stepZ;
    const c0 = Math.max(0, Math.min(columns - 2, Math.floor(gx)));
    const r0 = Math.max(0, Math.min(rows - 2, Math.floor(gz)));
    const fx = gx - c0;
    const fz = gz - r0;
    const at = (c: number, r: number) => heights[r * columns + c] ?? 0;
    const top = at(c0, r0) * (1 - fx) + at(c0 + 1, r0) * fx;
    const bottom = at(c0, r0 + 1) * (1 - fx) + at(c0 + 1, r0 + 1) * fx;
    return (top * (1 - fz) + bottom * fz) * HEIGHT_SCALE;
  };
  return { geometry, heightAt };
}

/** Land just outside every polygon (inside the noisy coast) belongs to the closest zone. */
function nearestZone(x: number, y: number): CityZoneId | null {
  let best: CityZoneId | null = null;
  let bestDistance = Infinity;
  for (const zone of CITY_ZONES) {
    const points = zone.polygon.map((key) => CITY_ZONE_VERTICES[key]);
    const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    const distance = Math.hypot(x - cx, y - cy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = zone.id;
    }
  }
  return best;
}
