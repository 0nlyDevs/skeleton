/**
 * Sea shader: deep to shallow colour from the baked depth (`aShallow`),
 * small moving waves for the normals, a fresnel blend towards the sky, a sun
 * glint and foam where the water meets the shore.
 */
export const waterVertex = /* glsl */ `
  attribute float aShallow;
  varying float vShallow;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vShallow = aShallow;
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
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying float vShallow;
  varying vec3 vWorld;
  varying float vFogDepth;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float waves(vec2 p) {
    float t = uTime * 0.35;
    return noise(p * 2.2 + vec2(t, t * 0.6)) * 0.6 + noise(p * 5.3 - vec2(t * 1.3, -t)) * 0.4;
  }

  void main() {
    vec2 p = vWorld.xz;
    float e = 0.05;
    float h = waves(p);
    vec3 normal = normalize(vec3(waves(p + vec2(e, 0.0)) - h, 0.6, waves(p + vec2(0.0, e)) - h));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

    vec3 color = mix(uDeep, uShallow, smoothstep(0.0, 1.0, vShallow));
    color = mix(color, uSky, fresnel * 0.55);
    vec3 halfDir = normalize(uSun + viewDir);
    color += vec3(1.0, 0.96, 0.88) * pow(max(dot(normal, halfDir), 0.0), 180.0) * 1.4;

    // Foam: a broken white band right at the shore.
    float foam = smoothstep(0.82, 0.97, vShallow) * smoothstep(0.35, 0.75, noise(p * 14.0 + uTime * 0.6));
    color = mix(color, vec3(0.95), foam * 0.75);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 0.94);
  }
`;
