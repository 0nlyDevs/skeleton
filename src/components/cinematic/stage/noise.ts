import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from "three";

/** Small seeded generator, so the island looks the same on every visit. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function latticeHash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Fractal value noise that repeats exactly every `size` pixels. */
function tileableFbm(size: number, seed: number, octaves: number): Float32Array {
  const out = new Float32Array(size * size);
  let amplitude = 0.5;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const period = 4 << octave;
    const scale = period / size;
    for (let y = 0; y < size; y += 1) {
      const fy = y * scale;
      const iy = Math.floor(fy);
      const ty = fy - iy;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x += 1) {
        const fx = x * scale;
        const ix = Math.floor(fx);
        const tx = fx - ix;
        const sx = tx * tx * (3 - 2 * tx);
        const a = latticeHash(ix % period, iy % period, seed + octave);
        const b = latticeHash((ix + 1) % period, iy % period, seed + octave);
        const c = latticeHash(ix % period, (iy + 1) % period, seed + octave);
        const d = latticeHash((ix + 1) % period, (iy + 1) % period, seed + octave);
        out[y * size + x] = (out[y * size + x] ?? 0) + amplitude * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < out.length; i += 1) out[i] = Math.min(1, Math.max(0, (((out[i] ?? 0) / total - 0.5) * 1.7 + 0.5)));
  return out;
}

export interface NoiseField {
  readonly texture: DataTexture;
  /** The value a shader reads at the same coordinates: channel 0 = height, 3 = the second height. */
  readonly sample: (u: number, v: number, channel: 0 | 3) => number;
}

/**
 * One repeating texture shared by every shader of the stage:
 * R = height, G/B = its slope along x and y (0.5 = flat), A = a second,
 * unrelated height. Reading the slope from the texture gives surface detail
 * for one fetch instead of three. The same values stay readable from
 * JavaScript, so trees grow exactly where the ground shader paints forest.
 */
export function createNoise(size = 256): NoiseField {
  const height = tileableFbm(size, 11, 6);
  const other = tileableFbm(size, 97, 5);
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)] ?? 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      data[i] = Math.round((height[y * size + x] ?? 0) * 255);
      data[i + 1] = Math.round(Math.min(1, Math.max(0, 0.5 + (at(x + 1, y) - at(x - 1, y)) * 6)) * 255);
      data[i + 2] = Math.round(Math.min(1, Math.max(0, 0.5 + (at(x, y + 1) - at(x, y - 1)) * 6)) * 255);
      data[i + 3] = Math.round((other[y * size + x] ?? 0) * 255);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const wrap = (n: number) => ((n % size) + size) % size;
  const sample = (u: number, v: number, channel: 0 | 3): number => {
    const source = channel === 0 ? height : other;
    const x = u * size - 0.5;
    const y = v * size - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const read = (cx: number, cy: number) => source[wrap(cy) * size + wrap(cx)] ?? 0;
    const top = read(x0, y0) * (1 - fx) + read(x0 + 1, y0) * fx;
    const bottom = read(x0, y0 + 1) * (1 - fx) + read(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
  return { texture, sample };
}
