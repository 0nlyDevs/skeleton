/**
 * Sea shader. Depth comes from the terrain's height texture, sampled per
 * pixel with linear filtering, so the shoreline, the shallows and the foam
 * are smooth curves rather than the steps of the terrain grid. Waves are two
 * scales of moving noise; the surface mirrors the sky at grazing angles and
 * catches a sun glint.
 */
export const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vFogDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

export const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSun;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform sampler2D uHeight;
  uniform vec4 uBounds;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vWorld;
  varying float vFogDepth;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float waves(vec2 p) {
    float t = uTime * 0.3;
    return noise(p * 1.6 + vec2(t, t * 0.7)) * 0.5 + noise(p * 4.1 - vec2(t * 1.4, -t * 0.8)) * 0.3 + noise(p * 11.0 + vec2(-t * 2.0, t)) * 0.2;
  }
  float groundAt(vec2 xz) {
    vec2 uv = (xz - uBounds.xy) / uBounds.zw;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -0.4;
    return texture2D(uHeight, uv).r * 0.8 - 0.4;
  }

  void main() {
    vec2 p = vWorld.xz;
    float ground = groundAt(p);
    // Water depth: 0 at the shore, about 0.4 far out.
    float depth = max(0.0, -ground);
    if (ground > 0.004) discard;

    float e = 0.04;
    float h = waves(p);
    vec3 normal = normalize(vec3(waves(p + vec2(e, 0.0)) - h, 0.5, waves(p + vec2(0.0, e)) - h));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);

    vec3 color = mix(uShallow, uMid, smoothstep(0.0, 0.07, depth));
    color = mix(color, uDeep, smoothstep(0.06, 0.32, depth));
    color = mix(color, uSky, fresnel * 0.5);
    vec3 halfDir = normalize(uSun + viewDir);
    color += vec3(1.0, 0.95, 0.85) * pow(max(dot(normal, halfDir), 0.0), 220.0) * 1.2;

    // Foam: a thin broken line that hugs the shore and breathes with the waves.
    float shore = 1.0 - smoothstep(0.0, 0.03, depth);
    float churn = noise(p * 22.0 + vec2(uTime * 0.8, -uTime * 0.5));
    float foam = shore * smoothstep(0.35, 0.8, churn + 0.25 * sin(uTime * 1.6 + depth * 120.0));
    color = mix(color, vec3(0.97, 0.98, 0.98), foam * 0.85);

    float alpha = mix(0.72, 0.97, smoothstep(0.0, 0.05, depth));
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), alpha);
  }
`;
