import type { Material, WebGLProgramParametersWithUniforms } from "three";

/**
 * Shader patches shared by the planets.
 *
 * `installDissolve` adds a noise dissolve to any built-in material: as
 * `uDissolve` goes 0 → 1, a disappearing planet burns away along a glowing
 * edge while an appearing one (`invert`) grows from the same noise. Both
 * planets read the same uniform object, so the two edges meet exactly.
 */

export interface DissolveUniforms {
  uDissolve: { value: number };
  uEdgeColor: { value: { r: number; g: number; b: number } };
}

const NOISE = /* glsl */ `
  float tnHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float tnNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(tnHash(i), tnHash(i + vec3(1, 0, 0)), f.x), mix(tnHash(i + vec3(0, 1, 0)), tnHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(tnHash(i + vec3(0, 0, 1)), tnHash(i + vec3(1, 0, 1)), f.x), mix(tnHash(i + vec3(0, 1, 1)), tnHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }
  float tnFbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * tnNoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`;

export interface PatchOptions {
  readonly dissolve: DissolveUniforms;
  /** The appearing planet uses the inverted mask. */
  readonly invert?: boolean;
  /** Earth's surface: city lights only where the sun does not shine. */
  readonly nightLights?: { uSunView: { value: unknown } };
}

export function patchMaterial(material: Material, options: PatchOptions): void {
  if (material.userData.tnPatched) return;
  material.userData.tnPatched = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uDissolve = options.dissolve.uDissolve;
    shader.uniforms.uEdgeColor = options.dissolve.uEdgeColor;
    if (options.nightLights) shader.uniforms.uSunView = options.nightLights.uSunView;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTnObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTnObj = normalize(position);");

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTnObj;
        uniform float uDissolve;
        uniform vec3 uEdgeColor;
        ${options.nightLights ? "uniform vec3 uSunView;" : ""}
        ${NOISE}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        options.nightLights
          ? `#include <emissivemap_fragment>
            float tnNight = smoothstep(0.12, -0.3, dot(normal, uSunView));
            totalEmissiveRadiance *= tnNight * 2.2;`
          : "#include <emissivemap_fragment>",
      )
      .replace(
        "#include <dithering_fragment>",
        `float tnN = tnFbm(vTnObj * 3.2) * 0.9 + 0.05;
        float tnT = ${options.invert ? "uDissolve * 1.08" : "uDissolve * 1.08 - 0.04"};
        ${options.invert ? "if (tnN > tnT) discard;" : "if (tnN < tnT) discard;"}
        float tnEdge = ${options.invert ? "smoothstep(tnT - 0.07, tnT, tnN)" : "smoothstep(tnT + 0.07, tnT, tnN)"};
        tnEdge *= step(0.001, uDissolve) * step(uDissolve, 0.999);
        gl_FragColor.rgb += uEdgeColor * tnEdge * 1.4;
        #include <dithering_fragment>`,
      );
  };
  // Closures share one source text, so three.js would reuse the first program for every variant.
  material.customProgramCacheKey = () => `tn-dissolve-${options.invert ? 1 : 0}-${options.nightLights ? 1 : 0}`;
  if ("transmission" in material) (material as Material & { transmission: number }).transmission = 0;
  material.needsUpdate = true;
}

/** Soft halo around a planet, brighter on the lit limb, additive. */
export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-viewPos.xyz);
    gl_Position = projectionMatrix * viewPos;
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunView;
  uniform float uIntensity;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    float d = dot(vNormalView, vViewDir);
    // Back faces of a slightly larger sphere: 0 at the halo's edge, 1 at the planet's limb.
    float halo = pow(smoothstep(0.0, -0.5, d), 2.4);
    float lit = smoothstep(-0.35, 0.6, dot(vNormalView, uSunView));
    float strength = halo * (0.18 + 0.82 * lit) * uIntensity;
    gl_FragColor = vec4(uColor * strength, strength);
  }
`;

/** Thin fresnel rim on the planet itself, so the lit edge glows instead of ending on a hard line. */
export const rimFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunView;
  uniform float uIntensity;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - clamp(dot(vNormalView, vViewDir), 0.0, 1.0), 5.0);
    float lit = smoothstep(-0.2, 0.7, dot(vNormalView, uSunView));
    float strength = fresnel * (0.12 + 0.88 * lit) * uIntensity;
    gl_FragColor = vec4(uColor * strength, strength);
  }
`;
