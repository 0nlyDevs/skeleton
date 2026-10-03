import { BufferAttribute, DataTexture, LinearFilter, Mesh, MeshStandardMaterial, RedFormat, UnsignedByteType } from "three";

import { buildRoadNetwork } from "@/components/city-map/city-map-roads";
import { buildTerrain, MAP_H, MAP_W, toMap, toWorld } from "@/components/city-map/city-map-terrain";

import { patchStandard, type Atmosphere } from "./atmosphere";

/**
 * The ground of the island. The shape is the one of the city map
 * (`buildTerrain`), so the landing shows the same Terra Nova as `/city-map`;
 * here the relief is taller, the mountains get crags, and the surface is
 * painted in the shader: one look per district, rock on slopes, snow, wet
 * shores, lava in the Ember Wastes and the street grid of Nova Prime.
 */

/** How much taller the land is here than on the city map. */
const RELIEF = 1.7;

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

/** Sharp crests, for mountain detail. */
function crags(x: number, y: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < 4; i += 1) {
    const n = 1 - Math.abs(valueNoise(x * frequency, y * frequency) * 2 - 1);
    value += amplitude * n * n;
    frequency *= 2.07;
    amplitude *= 0.5;
  }
  return value;
}

/** Box blur by running sums: the cost does not grow with the radius. */
function blur(values: Float32Array, columns: number, rows: number, radius: number): void {
  const line = new Float32Array(Math.max(columns, rows));
  for (let pass = 0; pass < 2; pass += 1) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) line[c] = values[r * columns + c] ?? 0;
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += line[Math.min(columns - 1, Math.max(0, k))] ?? 0;
      for (let c = 0; c < columns; c += 1) {
        values[r * columns + c] = sum / (radius * 2 + 1);
        sum += (line[Math.min(columns - 1, c + radius + 1)] ?? 0) - (line[Math.max(0, c - radius)] ?? 0);
      }
    }
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < rows; r += 1) line[r] = values[r * columns + c] ?? 0;
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += line[Math.min(rows - 1, Math.max(0, k))] ?? 0;
      for (let r = 0; r < rows; r += 1) {
        values[r * columns + c] = sum / (radius * 2 + 1);
        sum += (line[Math.min(rows - 1, r + radius + 1)] ?? 0) - (line[Math.max(0, r - radius)] ?? 0);
      }
    }
  }
}

export interface WorldTerrain {
  readonly mesh: Mesh;
  /** Sea-floor depth for the water shader (see `TerrainResult.heightTexture`). */
  readonly heightTexture: DataTexture;
  readonly bounds: { readonly minX: number; readonly minZ: number; readonly width: number; readonly depth: number };
  /** Ground height in world units at a point of the 1000 × 640 map. */
  readonly heightAt: (mapX: number, mapY: number) => number;
  /** District index (order of `CITY_ZONE_IDS`) at a map point, -1 at sea. */
  readonly zoneAt: (mapX: number, mapY: number) => number;
  dispose(): void;
}

const GROUND_PARS = /* glsl */ `
  varying vec4 vBiomeA;
  varying vec4 vBiomeB;
  uniform sampler2D uRoads;
  vec4 tnN2;
  vec4 tnN3;
  vec4 tnN4;
  float tnWet;
  float tnSnow;
  float tnHash(vec2 v) { return fract(sin(dot(v, vec2(41.3, 289.1))) * 43758.5453); }
`;

const GROUND_COLOR = /* glsl */ `
  {
    vec2 p = vTnWorld.xz;
    float h = vTnWorld.y;
    vec4 n1 = texture2D(uNoise, p * 0.083);
    tnN2 = texture2D(uNoise, p * 0.61 + 0.31);
    tnN3 = texture2D(uNoise, p * 4.3 + 0.67);
    tnN4 = texture2D(uNoise, p * 27.0 + 0.13);
    float tone = n1.r * 0.55 + tnN2.r * 0.45;
    float grain = tnN3.r * 0.6 + tnN4.r * 0.4;
    float slope = 1.0 - normalize(vTnUp).y;
    vec2 mp = p / 0.02 + vec2(500.0, 320.0);
    float land = step(0.03, h);

    vec4 wa = vBiomeA;
    vec4 wb = vBiomeB;
    float total = wa.x + wa.y + wa.z + wa.w + wb.x + wb.y + wb.z + wb.w;

    // Verdant Basin: canopy forest where the second noise is high, fields elsewhere.
    float forest = smoothstep(0.5, 0.6, n1.a);
    vec2 fuv = mat2(0.94, -0.34, 0.34, 0.94) * mp / 5.0;
    vec2 plot = floor(fuv);
    float crop = tnHash(plot);
    vec2 fe = abs(fract(fuv) - 0.5);
    float hedge = smoothstep(0.42, 0.48, max(fe.x, fe.y));
    vec3 fieldCol = crop < 0.34 ? tnC(0.36, 0.5, 0.19) : (crop < 0.67 ? tnC(0.71, 0.6, 0.28) : tnC(0.47, 0.31, 0.2));
    fieldCol *= 0.9 + 0.1 * sin((fuv.x + fuv.y * (crop - 0.5)) * 50.0);
    fieldCol = mix(fieldCol, tnC(0.16, 0.27, 0.11), hedge);
    vec3 cVerdant = mix(fieldCol, mix(tnC(0.09, 0.2, 0.08), tnC(0.19, 0.32, 0.12), tone), forest);

    vec3 cCrystal = mix(tnC(0.45, 0.33, 0.31), tnC(0.78, 0.72, 0.75), clamp(h * 0.55 + tone * 0.4, 0.0, 1.0));
    vec3 cEmber = mix(tnC(0.12, 0.1, 0.1), tnC(0.38, 0.19, 0.12), tone);
    vec3 cFrost = mix(tnC(0.36, 0.3, 0.28), tnC(0.56, 0.52, 0.5), tone);
    vec3 cDelta = mix(tnC(0.22, 0.34, 0.18), tnC(0.48, 0.47, 0.25), tone);
    vec3 cNova = mix(tnC(0.52, 0.45, 0.4), tnC(0.68, 0.62, 0.56), tone);
    vec3 cObsidian = mix(tnC(0.07, 0.07, 0.08), tnC(0.22, 0.18, 0.19), tone);
    vec3 cSkyport = mix(tnC(0.62, 0.38, 0.23), tnC(0.83, 0.6, 0.39), tone);

    vec3 col = (cCrystal * wa.x + cVerdant * wa.y + cEmber * wa.z + cFrost * wa.w
      + cDelta * wb.x + cNova * wb.y + cObsidian * wb.z + cSkyport * wb.w) / max(total, 0.001);
    col *= 0.78 + 0.44 * grain;

    // Bare rock where the ground is steep, with uneven strata.
    float rock = smoothstep(0.1, 0.3, slope + (tnN2.r - 0.5) * 0.12);
    vec3 rockCol = mix(col * 0.5, tnC(0.42, 0.32, 0.28), 0.55) * (0.88 + 0.12 * sin(h * 31.0 + tnN2.r * 16.0 + tnN3.a * 5.0));
    col = mix(col, rockCol * (0.8 + 0.4 * tnN4.a), rock);

    // Roads between the districts, bent by the land.
    float way = texture2D(uRoads, (mp + (tnN2.gb - 0.5) * 16.0) / vec2(1000.0, 640.0)).r * 8.0;
    float road = (1.0 - smoothstep(0.45, 0.95, way)) * land * (1.0 - smoothstep(0.75, 0.95, wb.y));

    // Streets of the capital: avenues on the city map's grid, lanes between them.
    vec2 grid = abs(fract((mp - vec2(324.0, 228.0)) / 24.0 + 0.5) - 0.5) * 24.0;
    vec2 lanes = abs(fract((mp - vec2(324.0, 228.0)) / 8.0 + 0.5) - 0.5) * 8.0;
    float street = max(1.0 - smoothstep(0.75, 1.25, min(grid.x, grid.y)), 1.0 - smoothstep(0.35, 0.7, min(lanes.x, lanes.y)));
    street *= smoothstep(0.6, 0.85, wb.y) * land;
    float asphalt = max(road, street);
    col = mix(col, tnC(0.2, 0.19, 0.19), asphalt * 0.85);

    // Homes too small to model: roofs by day, a lit window by night.
    float settled = clamp(wb.x * 0.5 + wa.y * 0.3 * (1.0 - forest) + wb.w * 0.55 + wb.z * 0.3 + wa.z * 0.2 + wa.x * 0.16 + wa.w * 0.04, 0.0, 1.0);
    settled = max(settled * smoothstep(0.4, 0.62, tnN2.a), (1.0 - smoothstep(1.0, 5.0, way)) * 0.5) * (1.0 - rock) * land * (1.0 - asphalt);
    vec2 hc = p / 0.018;
    vec2 hid = floor(hc);
    vec2 hf = fract(hc) - 0.5;
    float hr = tnHash(hid);
    float roof = step(1.0 - settled * 0.75, hr) * step(abs(hf.x), 0.3) * step(abs(hf.y), 0.18 + 0.14 * fract(hr * 9.7));
    float close = 1.0 - smoothstep(0.3, 0.8, fwidth(hc.x) + fwidth(hc.y));
    col = mix(col, mix(tnC(0.93, 0.91, 0.87), tnC(0.74, 0.44, 0.31), step(0.62, fract(hr * 5.3))), roof * close);

    // Lava cracks in the Ember Wastes.
    float crack = (1.0 - smoothstep(0.0, 0.016, abs(tnN2.a - 0.5))) * smoothstep(0.5, 0.66, n1.r) * smoothstep(0.5, 0.9, wa.z) * land;
    col = mix(col, tnC(0.05, 0.03, 0.03), crack * 0.8);
    totalEmissiveRadiance += tnC(1.0, 0.36, 0.07) * crack * (1.5 + 0.7 * sin(uTime * 0.8 + n1.a * 20.0));

    // Snow: low in Frostpeak, only on the highest crests elsewhere.
    float snowLine = mix(2.9, 0.62, wa.w) + (tnN2.r - 0.5) * 0.4;
    tnSnow = smoothstep(snowLine, snowLine + 0.22, h) * (1.0 - smoothstep(mix(0.42, 0.62, wa.w), mix(0.78, 0.97, wa.w), slope + (tnN3.r - 0.5) * 0.2));
    col = mix(col, tnC(0.9, 0.93, 0.97), tnSnow);

    // Beaches (black on the Obsidian Coast), then the wet band at the waterline.
    vec3 sand = mix(tnC(0.8, 0.66, 0.49), tnC(0.09, 0.09, 0.1), smoothstep(0.25, 0.65, wb.z)) * (0.85 + 0.3 * tnN4.r);
    col = mix(sand, col, clamp(total * 1.25, 0.0, 1.0));
    col = mix(col, sand, 1.0 - smoothstep(0.012, 0.06, h + (tnN2.r - 0.5) * 0.03));
    tnWet = 1.0 - smoothstep(0.0, 0.022, h);
    col *= mix(1.0, 0.5, tnWet);

    // After dark: lamps along streets and roads, and the homes.
    vec3 warm = tnC(1.0, 0.72, 0.42);
    float lamps = street * step(0.45, tnN4.r) * 0.42 + road * step(0.5, tnN4.a) * 1.1;
    float homes = roof * close * step(0.4, fract(hr * 3.1)) * 2.2 + settled * (1.0 - close) * step(0.72, tnN4.a) * 0.9;
    totalEmissiveRadiance += warm * (lamps + homes) * uLights;

    diffuseColor.rgb = col;
  }
`;

const GROUND_NORMAL = /* glsl */ `
  {
    float bump = 1.0 - tnSnow * 0.7;
    vec2 tilt = (tnN2.gb - 0.5) * 0.8 + (tnN3.gb - 0.5) * 0.6 + (tnN4.gb - 0.5) * 0.45;
    vec3 facing = normalize(normalize(vTnUp) - vec3(tilt.x, 0.0, tilt.y) * bump);
    normal = normalize(mat3(viewMatrix) * facing);
  }
`;

/** Distance to the nearest road of the city map, one texel per map unit, 8 map units = white. */
function buildRoadTexture(): DataTexture {
  const reach = 8;
  const data = new Uint8Array(MAP_W * MAP_H).fill(255);
  for (const road of buildRoadNetwork()) {
    const [ax, ay] = road.a;
    const [bx, by] = road.b;
    const dx = bx - ax;
    const dy = by - ay;
    const span = dx * dx + dy * dy || 1;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by) - reach)); y <= Math.min(MAP_H - 1, Math.ceil(Math.max(ay, by) + reach)); y += 1) {
      for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - reach)); x <= Math.min(MAP_W - 1, Math.ceil(Math.max(ax, bx) + reach)); x += 1) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / span));
        const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) * (road.major ? 0.8 : 1.15);
        const value = Math.min(255, Math.round((d / reach) * 255));
        const i = y * MAP_W + x;
        if (value < (data[i] ?? 255)) data[i] = value;
      }
    }
  }
  const texture = new DataTexture(data, MAP_W, MAP_H, RedFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function buildWorldTerrain(atmosphere: Atmosphere, segmentsX = 480, segmentsY = 336): WorldTerrain {
  const terrain = buildTerrain(segmentsX, segmentsY);
  const { geometry, bounds } = terrain;
  const columns = segmentsX + 1;
  const rows = segmentsY + 1;
  const count = columns * rows;
  const position = geometry.getAttribute("position") as BufferAttribute;
  const zones = geometry.getAttribute("aZone") as BufferAttribute;

  // One soft weight per district, so neighbouring looks melt into each other.
  const biomeA = new Uint8Array(count * 4);
  const biomeB = new Uint8Array(count * 4);
  const weight = new Float32Array(count);
  const radius = Math.round(columns / 80);
  for (let zone = 0; zone < 8; zone += 1) {
    for (let i = 0; i < count; i += 1) weight[i] = zones.getX(i) === zone ? 1 : 0;
    blur(weight, columns, rows, radius);
    const target = zone < 4 ? biomeA : biomeB;
    for (let i = 0; i < count; i += 1) target[i * 4 + (zone % 4)] = Math.round((weight[i] ?? 0) * 255);
  }

  const heights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    let y = position.getY(i);
    if (y > 0) {
      // Only Frostpeak's mountains are cut into sharp ridges; the other heights stay rounded.
      const frost = (biomeA[i * 4 + 3] ?? 0) / 255;
      y *= RELIEF;
      const mountain = Math.min(1, Math.max(0, (y - 0.22) / 0.8)) * (0.4 + 0.6 * frost);
      y *= 1 - mountain + mountain * (0.6 + 0.85 * crags(x * 1.05 + 3.1, z * 1.05 + 1.7));
      y += (crags(x * 3.1, z * 3.1) - 0.4) * 0.11 * mountain;
      y += (valueNoise(x * 3.3, z * 3.3) - 0.5) * 0.024 * Math.min(1, y / 0.08);
      y = Math.max(0.004, y);
    }
    heights[i] = y;
    position.setY(i, y);
  }
  geometry.computeVertexNormals();

  const zoneIndex = new Int8Array(count);
  for (let i = 0; i < count; i += 1) zoneIndex[i] = zones.getX(i);
  geometry.setAttribute("aBiomeA", new BufferAttribute(biomeA, 4, true));
  geometry.setAttribute("aBiomeB", new BufferAttribute(biomeB, 4, true));
  geometry.deleteAttribute("color");
  geometry.deleteAttribute("aTint");
  geometry.deleteAttribute("aZone");
  geometry.deleteAttribute("uv");

  const roads = buildRoadTexture();
  const material = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.94, metalness: 0 });
  patchStandard(material, atmosphere, {
    key: "ground",
    uniforms: { uRoads: { value: roads } },
    vertexPars: "attribute vec4 aBiomeA;\nattribute vec4 aBiomeB;\nvarying vec4 vBiomeA;\nvarying vec4 vBiomeB;",
    vertex: "vBiomeA = aBiomeA;\nvBiomeB = aBiomeB;",
    fragmentPars: GROUND_PARS,
    color: GROUND_COLOR,
    roughness: "roughnessFactor = mix(mix(0.94, 0.5, tnSnow), 0.22, tnWet);",
    normal: GROUND_NORMAL,
    reflect: 0.5,
  });
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.matrixAutoUpdate = false;

  const stepX = bounds.width / segmentsX;
  const stepZ = bounds.depth / segmentsY;
  const cellOf = (mapX: number, mapY: number) => {
    const world = toWorld(mapX, mapY);
    return { gx: (world.x - bounds.minX) / stepX, gz: (world.z - bounds.minZ) / stepZ };
  };
  const heightAt = (mapX: number, mapY: number): number => {
    const { gx, gz } = cellOf(mapX, mapY);
    const c0 = Math.max(0, Math.min(columns - 2, Math.floor(gx)));
    const r0 = Math.max(0, Math.min(rows - 2, Math.floor(gz)));
    const fx = Math.min(1, Math.max(0, gx - c0));
    const fz = Math.min(1, Math.max(0, gz - r0));
    const at = (c: number, r: number) => heights[r * columns + c] ?? 0;
    const top = at(c0, r0) * (1 - fx) + at(c0 + 1, r0) * fx;
    const bottom = at(c0, r0 + 1) * (1 - fx) + at(c0 + 1, r0 + 1) * fx;
    return top * (1 - fz) + bottom * fz;
  };
  const zoneAt = (mapX: number, mapY: number): number => {
    const { gx, gz } = cellOf(mapX, mapY);
    const c = Math.max(0, Math.min(columns - 1, Math.round(gx)));
    const r = Math.max(0, Math.min(rows - 1, Math.round(gz)));
    return zoneIndex[r * columns + c] ?? -1;
  };

  return {
    mesh,
    heightTexture: terrain.heightTexture,
    bounds,
    heightAt,
    zoneAt,
    dispose() {
      geometry.dispose();
      material.dispose();
      roads.dispose();
      terrain.heightTexture.dispose();
    },
  };
}

/** World position of a map point, on the ground. */
export function groundPoint(terrain: WorldTerrain, mapX: number, mapY: number): { x: number; y: number; z: number } {
  const world = toWorld(mapX, mapY);
  return { x: world.x, y: Math.max(0, terrain.heightAt(mapX, mapY)), z: world.z };
}

export { toMap, toWorld };
