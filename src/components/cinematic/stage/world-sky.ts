import { BackSide, BufferAttribute, BufferGeometry, Group, Mesh, ShaderMaterial, SphereGeometry, type Camera } from "three";

import { ATMOSPHERE_GLSL, CLOUD_Y, type Atmosphere } from "./atmosphere";

/**
 * Everything above the island: the sky itself (colour, sun, stars, the ringed
 * sister planet and its moon, high cirrus, an aurora over the northern peaks
 * at night) and the low cloud layer whose shadows drift over the ground.
 */

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  varying vec3 vDir;
  uniform float uStars;
  uniform vec3 uPlanetDir;
  ${ATMOSPHERE_GLSL}

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  /* A lit sphere seen in the sky: x = lit amount, y = coverage; q is the position on its disc. */
  vec2 body(vec3 dir, vec3 centre, float radius, out vec2 q) {
    vec3 px = normalize(cross(vec3(0.0, 1.0, 0.0), centre));
    vec3 py = cross(centre, px);
    q = vec2(dot(dir, px), dot(dir, py)) / radius;
    float r2 = dot(q, q);
    if (r2 > 1.0 || dot(dir, centre) < 0.0) return vec2(0.0);
    vec3 n = px * q.x + py * q.y - centre * sqrt(1.0 - r2);
    float lit = smoothstep(-0.05, 0.25, dot(n, uSunDir));
    return vec2(lit * (0.55 + 0.45 * sqrt(1.0 - r2)), smoothstep(1.0, 0.94, r2));
  }

  void main() {
    vec3 dir = normalize(vDir);
    vec3 col = tnSky(dir);
    float above = smoothstep(-0.02, 0.04, dir.y);

    // Stars, with a denser band across the sky.
    float night = uStars * smoothstep(-0.02, 0.3, dir.y);
    vec3 q3 = dir * 170.0;
    vec3 id = floor(q3);
    float seed = hash13(id);
    float band = exp(-pow(dot(dir, normalize(vec3(0.5, 0.35, 0.8))) * 3.2, 2.0));
    float star = step(0.975 - band * 0.03, seed) * smoothstep(0.24, 0.0, length(fract(q3) - 0.5));
    vec3 stars = mix(vec3(1.0, 0.82, 0.66), vec3(0.72, 0.84, 1.0), hash13(id + 7.0)) * star * (0.65 + 0.35 * sin(uTime * 1.7 + seed * 90.0)) * 2.4;
    stars += vec3(0.5, 0.56, 0.8) * band * 0.05 * (0.5 + texture2D(uNoise, dir.xz * 2.0).r);

    // The sister planet, its rings and its moon: lit by the same sun, so their phase follows the hour.
    vec2 q;
    vec2 planet = body(dir, uPlanetDir, 0.085, q);
    float bands = sin(q.y * 11.0 + sin(q.x * 3.0) * 0.8 + texture2D(uNoise, q * 0.11 + 0.3).r * 3.0);
    vec3 planetCol = mix(vec3(0.86, 0.6, 0.44), vec3(0.96, 0.84, 0.7), bands * 0.5 + 0.5) * planet.x;
    vec2 rq = mat2(0.9, 0.436, -0.436, 0.9) * q;
    rq.y /= 0.24;
    float rr = length(rq);
    float lanes = texture2D(uNoise, vec2(rr * 0.9, 0.37)).r * 0.7 + texture2D(uNoise, vec2(rr * 4.1, 0.71)).a * 0.3;
    float ring = smoothstep(1.38, 1.5, rr) * smoothstep(2.42, 2.25, rr) * smoothstep(0.25, 0.7, lanes) * step(0.0, dot(dir, uPlanetDir));
    ring *= 1.0 - planet.y * step(0.0, rq.y);
    vec2 mq;
    vec2 moon = body(dir, normalize(vec3(0.42, 0.5, -0.76)), 0.017, mq);
    float bodies = max(planet.y, moon.y);
    col += (stars * (1.0 - bodies) * (1.0 - ring * 0.6)) * night;
    col += (planetCol * 0.95 * planet.y + vec3(0.9, 0.8, 0.7) * ring * 0.26 + vec3(0.8, 0.8, 0.84) * moon.x * moon.y) * above;

    // The sun.
    float sun = dot(dir, uSunDir);
    col += uGlow * (smoothstep(0.99955, 0.99985, sun) * 32.0 + pow(max(sun, 0.0), 900.0) * 3.0) * above;

    // Aurora over the northern peaks, late at night.
    float aurora = smoothstep(0.7, 1.0, uStars);
    if (aurora > 0.01 && dir.y > 0.0) {
      float azimuth = atan(dir.x, -dir.z);
      float curtain = texture2D(uNoise, vec2(azimuth * 0.3 + uTime * 0.004, uTime * 0.005)).r;
      float lift = dir.y - (0.1 + curtain * 0.2);
      float rays = texture2D(uNoise, vec2(azimuth * 2.4, 0.3 + uTime * 0.008)).a;
      float glow = smoothstep(0.0, 0.035, lift) * exp(-lift * 8.0) * (0.3 + 0.7 * rays) * smoothstep(1.5, 0.3, abs(azimuth - 0.25));
      col += mix(vec3(0.12, 1.0, 0.55), vec3(0.7, 0.25, 0.95), clamp(lift * 4.5, 0.0, 1.0)) * glow * aurora * 0.34;
    }

    // High cirrus, catching the colour of the sun.
    if (dir.y > 0.015) {
      vec2 uv = dir.xz / (dir.y + 0.2) * 0.2 + uTime * 0.0011;
      float streaks = texture2D(uNoise, uv * vec2(0.55, 1.8)).r * 0.62 + texture2D(uNoise, uv * 2.6 + 0.4).a * 0.38;
      float cirrus = smoothstep(0.5, 0.86, streaks) * smoothstep(0.015, 0.28, dir.y) * 0.55;
      col = mix(col, uHorizon * 0.55 + uLightColor * 0.14 + tnGlow(dir) * 1.6 + uAmbient * 0.35, cirrus);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

const CLOUD_VERTEX = /* glsl */ `
  attribute float aSlice;
  varying vec3 vWorld;
  varying float vSlice;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vSlice = aSlice;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const CLOUD_FRAGMENT = /* glsl */ `
  varying vec3 vWorld;
  varying float vSlice;
  uniform float uOpacity;
  ${ATMOSPHERE_GLSL}

  void main() {
    float shape = tnCloudShape(vWorld.xz);
    float edge = (1.0 - uCloudCover) + 0.03 + abs(vSlice - 0.3) * 0.26;
    float density = smoothstep(edge, edge + 0.16, shape);
    if (density < 0.004) discard;
    float fluff = texture2D(uNoise, vWorld.xz * 0.41 + uWind * uTime * 3.0).r;
    density *= 0.75 + 0.5 * fluff;

    float toward = tnCloudShape(vWorld.xz + uLightDir.xz * 1.1);
    float lit = clamp(0.5 + (shape - toward) * 3.2, 0.0, 1.0) * 0.6 + vSlice * 0.4;
    vec3 view = normalize(vWorld - cameraPosition);
    vec3 shadowed = uAmbient * 0.95 + uHorizon * 0.14;
    vec3 sunlit = uLightColor * 0.36 + uAmbient * 0.9 + tnGlow(view) * 1.4;
    vec3 col = mix(shadowed, sunlit, lit);

    float reach = length(vWorld.xz - cameraPosition.xz);
    float alpha = clamp(density, 0.0, 1.0) * 0.5 * uOpacity * smoothstep(120.0, 40.0, reach);
    col = mix(col, tnFogColor(view), tnFogAmount(cameraPosition, vWorld) * 0.85);
    gl_FragColor = vec4(col, alpha);
  }
`;

const SLICES = 5;
const THICKNESS = 0.9;

export interface WorldSky {
  readonly group: Group;
  /** Call once per frame, after the camera moved. */
  follow(camera: Camera): void;
  dispose(): void;
}

export function buildSky(atmosphere: Atmosphere): WorldSky {
  const group = new Group();

  const domeGeometry = new SphereGeometry(1, 48, 32);
  const domeMaterial = new ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: atmosphere.uniforms,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });
  const dome = new Mesh(domeGeometry, domeMaterial);
  dome.scale.setScalar(600);
  dome.renderOrder = -10;
  dome.frustumCulled = false;

  // The cloud layer: a few stacked sheets, drawn from the top one down.
  const size = 260;
  const positions = new Float32Array(SLICES * 4 * 3);
  const slices = new Float32Array(SLICES * 4);
  const index: number[] = [];
  for (let s = 0; s < SLICES; s += 1) {
    const level = 1 - s / (SLICES - 1);
    const y = level * THICKNESS;
    const corners = [[-size, -size], [size, -size], [size, size], [-size, size]] as const;
    corners.forEach(([x, z], corner) => {
      positions.set([x, y, z], (s * 4 + corner) * 3);
      slices[s * 4 + corner] = level;
    });
    const o = s * 4;
    index.push(o, o + 1, o + 2, o, o + 2, o + 3, o, o + 2, o + 1, o, o + 3, o + 2);
  }
  const cloudGeometry = new BufferGeometry();
  cloudGeometry.setAttribute("position", new BufferAttribute(positions, 3));
  cloudGeometry.setAttribute("aSlice", new BufferAttribute(slices, 1));
  cloudGeometry.setIndex(index);
  const cloudMaterial = new ShaderMaterial({
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    uniforms: { ...atmosphere.uniforms, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
  });
  const clouds = new Mesh(cloudGeometry, cloudMaterial);
  clouds.position.y = CLOUD_Y;
  clouds.renderOrder = 3;
  clouds.frustumCulled = false;

  group.add(dome, clouds);
  return {
    group,
    follow(camera) {
      dome.position.copy(camera.position);
      clouds.position.set(camera.position.x, CLOUD_Y, camera.position.z);
    },
    dispose() {
      domeGeometry.dispose();
      domeMaterial.dispose();
      cloudGeometry.dispose();
      cloudMaterial.dispose();
    },
  };
}
