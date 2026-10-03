import { Color, DirectionalLight, HemisphereLight, Vector2, Vector3, type IUniform, type Material, type Texture, type WebGLProgramParametersWithUniforms } from "three";

/**
 * The sky model of Terra Nova: one number, `sol`, runs from dawn (0) to deep
 * night (1) and sets the sun, the colour of the sky, the haze and how many
 * city lights are on. Every material of the island reads the same uniforms,
 * so the ground, the sea and the sky always agree with each other.
 */

/** Height of the cloud layer above the sea, in world units. */
export const CLOUD_Y = 5.4;

interface SkyKey {
  readonly at: number;
  /** Sun elevation and azimuth in degrees (azimuth 0 = north, 90 = east). */
  readonly elevation: number;
  readonly azimuth: number;
  readonly zenith: string;
  readonly horizon: string;
  readonly glow: string;
  readonly light: string;
  readonly intensity: number;
  readonly sky: string;
  readonly ground: string;
  readonly ambient: number;
  readonly fog: number;
  readonly stars: number;
  readonly lights: number;
  readonly exposure: number;
  readonly cover: number;
}

const KEYS: readonly SkyKey[] = [
  { at: 0, elevation: 4.5, azimuth: 56, zenith: "#35508f", horizon: "#f0a47e", glow: "#ffae6e", light: "#ffb184", intensity: 2.6, sky: "#93a6d8", ground: "#5c3f34", ambient: 0.6, fog: 0.04, stars: 0.16, lights: 0.6, exposure: 1.02, cover: 0.44 },
  { at: 0.12, elevation: 14, azimuth: 96, zenith: "#3c72b8", horizon: "#f2cfa8", glow: "#ffd7a6", light: "#ffd8ae", intensity: 3.3, sky: "#a9c4ee", ground: "#6b4d3c", ambient: 0.78, fog: 0.036, stars: 0, lights: 0.04, exposure: 1, cover: 0.4 },
  { at: 0.38, elevation: 54, azimuth: 165, zenith: "#2a6dc2", horizon: "#c2d6e4", glow: "#fff1d8", light: "#fff4e2", intensity: 3.9, sky: "#b5d0f5", ground: "#70543f", ambient: 0.92, fog: 0.024, stars: 0, lights: 0, exposure: 1, cover: 0.36 },
  { at: 0.6, elevation: 30, azimuth: 232, zenith: "#2e66b2", horizon: "#e4d0ae", glow: "#ffe4ba", light: "#ffe2bb", intensity: 3.5, sky: "#aec6ea", ground: "#6e503c", ambient: 0.85, fog: 0.03, stars: 0, lights: 0, exposure: 1, cover: 0.4 },
  { at: 0.76, elevation: 8, azimuth: 262, zenith: "#3a4a8c", horizon: "#ff9a54", glow: "#ff873a", light: "#ff9858", intensity: 2.8, sky: "#9390c8", ground: "#5a3a2e", ambient: 0.58, fog: 0.048, stars: 0.04, lights: 0.4, exposure: 1.05, cover: 0.46 },
  { at: 0.86, elevation: -3, azimuth: 273, zenith: "#16224f", horizon: "#a8586a", glow: "#ff5a36", light: "#ff6e48", intensity: 0.6, sky: "#4d5294", ground: "#2a2030", ambient: 0.46, fog: 0.04, stars: 0.5, lights: 0.92, exposure: 1.15, cover: 0.4 },
  { at: 0.9, elevation: -9, azimuth: 277, zenith: "#0c1335", horizon: "#3a3158", glow: "#8a3a4a", light: "#7f8fd0", intensity: 0.03, sky: "#343c7a", ground: "#151528", ambient: 0.34, fog: 0.034, stars: 0.82, lights: 1, exposure: 1.2, cover: 0.34 },
  { at: 1, elevation: -22, azimuth: 288, zenith: "#040918", horizon: "#13203f", glow: "#101a3a", light: "#8fa8ff", intensity: 0.34, sky: "#22305e", ground: "#0c0f1c", ambient: 0.3, fog: 0.026, stars: 1, lights: 1, exposure: 1.2, cover: 0.3 },
];

/** From `MOON_FROM` on, the key light is the sister planet instead of the sun. */
const MOON_FROM = 0.9;
const PLANET_AZIMUTH = 30;
const PLANET_ELEVATION = 14;

function direction(elevation: number, azimuth: number, target: Vector3): Vector3 {
  const e = (elevation * Math.PI) / 180;
  const a = (azimuth * Math.PI) / 180;
  return target.set(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a));
}

export type AtmosphereUniforms = Record<
  | "uTime" | "uSunDir" | "uLightDir" | "uLightColor" | "uZenith" | "uHorizon" | "uGlow" | "uAmbient"
  | "uFogDensity" | "uFogFalloff" | "uStars" | "uLights" | "uNoise" | "uCloudCover" | "uWind" | "uPlanetDir",
  IUniform
>;

export class Atmosphere {
  readonly sun = new DirectionalLight("#ffffff", 3);
  readonly hemisphere = new HemisphereLight("#ffffff", "#444444", 0.8);
  readonly sunDirection = new Vector3();
  readonly lightDirection = new Vector3();
  readonly uniforms: AtmosphereUniforms;
  exposure = 1;
  /** 0 = lights off, 1 = full night. */
  lights = 0;

  private readonly a = new Color();
  private readonly b = new Color();
  private readonly planet = direction(PLANET_ELEVATION, PLANET_AZIMUTH, new Vector3());

  constructor(noise: Texture) {
    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: this.sunDirection },
      uLightDir: { value: this.lightDirection },
      uLightColor: { value: new Color() },
      uZenith: { value: new Color() },
      uHorizon: { value: new Color() },
      uGlow: { value: new Color() },
      uAmbient: { value: new Color() },
      uFogDensity: { value: 0.03 },
      uFogFalloff: { value: 0.55 },
      uStars: { value: 0 },
      uLights: { value: 0 },
      uNoise: { value: noise },
      uCloudCover: { value: 0.4 },
      uWind: { value: new Vector2(0.0016, 0.0007) },
      uPlanetDir: { value: this.planet },
    };
    this.update(0, 0);
  }

  private mix(from: string, to: string, f: number, target: Color): Color {
    return target.copy(this.a.set(from)).lerp(this.b.set(to), f);
  }

  update(sol: number, time: number): void {
    const t = Math.min(1, Math.max(0, sol));
    let index = 0;
    while (index < KEYS.length - 2 && t > (KEYS[index + 1]?.at ?? 1)) index += 1;
    const from = KEYS[index] ?? KEYS[0]!;
    const to = KEYS[index + 1] ?? from;
    const f = to.at > from.at ? (t - from.at) / (to.at - from.at) : 0;
    const lerp = (x: number, y: number) => x + (y - x) * f;
    const u = this.uniforms;

    direction(lerp(from.elevation, to.elevation), lerp(from.azimuth, to.azimuth), this.sunDirection);
    if (t >= MOON_FROM) this.lightDirection.copy(this.planet);
    else this.lightDirection.copy(this.sunDirection).setY(Math.max(0.06, this.sunDirection.y)).normalize();

    const intensity = lerp(from.intensity, to.intensity);
    this.mix(from.light, to.light, f, this.sun.color);
    this.sun.intensity = intensity;
    (u.uLightColor.value as Color).copy(this.sun.color).multiplyScalar(intensity);
    this.mix(from.zenith, to.zenith, f, u.uZenith.value as Color);
    this.mix(from.horizon, to.horizon, f, u.uHorizon.value as Color);
    this.mix(from.glow, to.glow, f, u.uGlow.value as Color);
    this.mix(from.sky, to.sky, f, this.hemisphere.color);
    this.mix(from.ground, to.ground, f, this.hemisphere.groundColor);
    this.hemisphere.intensity = lerp(from.ambient, to.ambient);
    (u.uAmbient.value as Color).copy(this.hemisphere.color).multiplyScalar(this.hemisphere.intensity * 0.55);
    u.uFogDensity.value = lerp(from.fog, to.fog);
    u.uStars.value = lerp(from.stars, to.stars);
    this.lights = lerp(from.lights, to.lights);
    u.uLights.value = this.lights;
    u.uCloudCover.value = lerp(from.cover, to.cover);
    u.uTime.value = time;
    this.exposure = lerp(from.exposure, to.exposure);
  }
}

/** Uniforms and helpers every stage shader shares (sky colour, haze, cloud shadows). */
export const ATMOSPHERE_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uAmbient;
  uniform float uFogDensity;
  uniform float uFogFalloff;
  uniform float uLights;
  uniform sampler2D uNoise;
  uniform float uCloudCover;
  uniform vec2 uWind;

  vec3 tnC(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }

  vec3 tnGlow(vec3 dir) {
    float s = max(dot(dir, uSunDir), 0.0);
    return uGlow * (pow(s, 5.0) * 0.32 + pow(s, 40.0) * 0.8);
  }
  vec3 tnSky(vec3 dir) {
    float h = clamp(dir.y, 0.0, 1.0);
    return mix(uHorizon, uZenith, pow(h, 0.42)) + tnGlow(dir) * (1.0 - 0.45 * h);
  }
  vec3 tnFogColor(vec3 dir) {
    return uHorizon + tnGlow(dir);
  }
  /* Haze that is thick near the sea and thins with altitude. */
  float tnFogAmount(vec3 eye, vec3 point) {
    vec3 d = point - eye;
    float t = length(d);
    float k = d.y / max(t, 1e-4) * uFogFalloff;
    float f = abs(k) < 1e-4 ? t : (1.0 - exp(-t * k)) / k;
    return 1.0 - exp(-uFogDensity * exp(-eye.y * uFogFalloff) * f);
  }
  /* Raw cloud density before the coverage threshold. */
  float tnCloudShape(vec2 xz) {
    vec2 uv = xz * 0.028 + uWind * uTime;
    return texture2D(uNoise, uv).r * 0.72 + texture2D(uNoise, uv * 3.1 + 0.37).a * 0.28;
  }
  float tnCloudField(vec2 xz) {
    float edge = 1.0 - uCloudCover;
    return smoothstep(edge, edge + 0.24, tnCloudShape(xz));
  }
  /* Shadow of the cloud layer on anything below it. */
  float tnCloudShade(vec3 point) {
    vec2 offset = uLightDir.xz / max(uLightDir.y, 0.2) * (${CLOUD_Y.toFixed(1)} - point.y);
    return 1.0 - 0.58 * tnCloudField(point.xz + offset);
  }
`;

export interface StandardPatch {
  /** Distinguishes the compiled program from other patched materials. */
  readonly key: string;
  readonly uniforms?: Record<string, IUniform>;
  readonly vertexPars?: string;
  readonly vertex?: string;
  readonly fragmentPars?: string;
  /** Runs after the base colour is known; may change `diffuseColor` and `totalEmissiveRadiance`. */
  readonly color?: string;
  readonly roughness?: string;
  /** Runs after the surface normal is known; may change `normal` (view space). */
  readonly normal?: string;
  /** How strongly smooth surfaces mirror the sky (default 0.6). */
  readonly reflect?: number;
  /** Transparent material that turns opaque at grazing angles, like a glass dome. */
  readonly glass?: boolean;
}

/**
 * Makes a built-in lit material part of the island: world position and world
 * normal as varyings (`vTnWorld`, `vTnUp`), cloud shadows on the sun's light
 * and the altitude haze instead of the default fog.
 */
export function patchStandard(material: Material, atmosphere: Atmosphere, patch: StandardPatch): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, atmosphere.uniforms, patch.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vTnWorld;\nvarying vec3 vTnUp;\n${patch.vertexPars ?? ""}`)
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 tnPoint = vec4(transformed, 1.0);
        vec3 tnNormal = objectNormal;
        #ifdef USE_INSTANCING
          tnPoint = instanceMatrix * tnPoint;
          tnNormal = mat3(instanceMatrix) * tnNormal;
        #endif
        vTnWorld = (modelMatrix * tnPoint).xyz;
        vTnUp = normalize(mat3(modelMatrix) * tnNormal);
        ${patch.vertex ?? ""}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vTnWorld;\nvarying vec3 vTnUp;\n${ATMOSPHERE_GLSL}\n${patch.fragmentPars ?? ""}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${patch.color ?? ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${patch.roughness ?? ""}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${patch.normal ?? ""}`)
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        float tnShade = tnCloudShade(vTnWorld);
        reflectedLight.directDiffuse *= tnShade;
        reflectedLight.directSpecular *= tnShade;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          vec3 tnView = normalize(vTnWorld - cameraPosition);
          vec3 tnFacing = inverseTransformDirection(normal, viewMatrix);
          vec3 tnMirror = reflect(tnView, tnFacing);
          tnMirror.y = abs(tnMirror.y);
          float tnFresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(-tnView, tnFacing), 0.0, 1.0), 5.0);
          outgoingLight += tnSky(tnMirror) * tnFresnel * (1.0 - roughnessFactor) * ${(patch.reflect ?? 0.6).toFixed(2)};
          ${patch.glass ? "diffuseColor.a = mix(diffuseColor.a, 1.0, tnFresnel);" : ""}
        }
        #include <opaque_fragment>`,
      )
      .replace(
        "#include <fog_fragment>",
        `gl_FragColor.rgb = mix(gl_FragColor.rgb, tnFogColor(normalize(vTnWorld - cameraPosition)), tnFogAmount(cameraPosition, vTnWorld));`,
      );
  };
  material.customProgramCacheKey = () => `tn-stage-${patch.key}`;
}
