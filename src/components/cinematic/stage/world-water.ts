import { Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from "three";

import { ATMOSPHERE_GLSL, type Atmosphere } from "./atmosphere";
import type { WorldTerrain } from "./world-terrain";

/**
 * The sea around the island, and its rivers: one large plane at sea level.
 * Waves are slopes read from the shared noise texture; the surface mirrors the
 * same sky the dome draws, turns turquoise over shallows, glitters under the
 * sun and foams where it meets the shore.
 */

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vWorld;
  uniform sampler2D uHeight;
  uniform vec4 uBounds;
  ${ATMOSPHERE_GLSL}

  float groundAt(vec2 xz) {
    vec2 uv = (xz - uBounds.xy) / uBounds.zw;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -0.4;
    return texture2D(uHeight, uv).r * 0.8 - 0.4;
  }

  void main() {
    vec2 p = vWorld.xz;
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 view = toEye / dist;

    vec2 w1 = texture2D(uNoise, p * 0.31 + uTime * vec2(0.011, 0.007)).gb - 0.5;
    vec2 w2 = texture2D(uNoise, p * 1.3 - uTime * vec2(0.023, -0.017)).gb - 0.5;
    vec2 w3 = texture2D(uNoise, p * 5.7 + uTime * vec2(-0.05, 0.063)).gb - 0.5;
    vec2 tilt = w1 * 0.55 + w2 * 0.5 + w3 * 0.42;
    vec3 n = normalize(vec3(-tilt.x * 0.85, 1.0, -tilt.y * 0.85));

    float depth = max(0.0, -groundAt(p + w1 * 0.05) + (w2.x - 0.1) * 0.006);
    vec3 mirror = reflect(-view, n);
    mirror.y = abs(mirror.y) + 0.015;
    mirror = normalize(mirror);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, view), 0.0), 5.0);

    float shade = tnCloudShade(vWorld);
    vec3 lightIn = uAmbient * 1.25 + uLightColor * max(uLightDir.y, 0.0) * 0.3 * shade;
    vec3 body = mix(tnC(0.1, 0.56, 0.52), tnC(0.012, 0.075, 0.14), 1.0 - exp(-depth * 13.0)) * lightIn;
    vec3 col = mix(body, tnSky(mirror), fresnel);

    // The sun's (or the sister planet's) path on the water.
    float glint = max(dot(mirror, uLightDir), 0.0);
    col += uLightColor * (pow(glint, 420.0) * 2.6 + pow(glint, 28.0) * 0.045) * shade;

    // Foam: a breathing line at the shore and thin crests further out.
    float shore = 1.0 - smoothstep(0.0, 0.03, depth);
    float wash = sin(depth * 380.0 - uTime * 1.5 + w1.x * 9.0) * 0.5 + 0.5;
    float foam = shore * smoothstep(0.5, 0.95, wash * 0.55 + texture2D(uNoise, p * 3.1).r * 0.75);
    foam = max(foam, (1.0 - smoothstep(0.0, 0.004, depth)) * 0.5) * (0.4 + 0.6 * smoothstep(0.35, 0.6, texture2D(uNoise, p * 1.7 + uTime * 0.01).a));
    col = mix(col, vec3(0.92, 0.95, 0.97) * (lightIn + uAmbient), foam * 0.85);

    float alpha = smoothstep(0.0, 0.004, depth) * mix(0.62, 1.0, 1.0 - exp(-depth * 45.0));
    alpha = max(alpha, max(fresnel, foam) * smoothstep(0.0, 0.004, depth));

    col = mix(col, tnFogColor(-view), tnFogAmount(cameraPosition, vWorld));
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface WorldWater {
  readonly mesh: Mesh;
  dispose(): void;
}

export function buildWater(atmosphere: Atmosphere, terrain: WorldTerrain): WorldWater {
  const geometry = new PlaneGeometry(1400, 1400);
  geometry.rotateX(-Math.PI / 2);
  const { bounds } = terrain;
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      ...atmosphere.uniforms,
      uHeight: { value: terrain.heightTexture },
      uBounds: { value: new Vector4(bounds.minX, bounds.minZ, bounds.width, bounds.depth) },
    },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 2;
  mesh.matrixAutoUpdate = false;
  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
