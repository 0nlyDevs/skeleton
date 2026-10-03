import gsap from "gsap";
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Fog,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferAttribute,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { CITY_PLACES, type PlaceKind } from "@/modules/alerts/city-map-data";
import { CITY_ZONES, CITY_ZONE_IDS, CITY_ZONE_VERTICES, zoneAt, zoneCentroid, type CityZoneId, type ZoneStatusId } from "@/modules/alerts/city-zones";

import { buildRoadNetwork, distanceToRoads, type RoadSegment } from "./city-map-roads";
import { buildTerrain, toMap, toWorld } from "./city-map-terrain";
import { waterFragment, waterVertex } from "./city-map-water";

/**
 * Terra Nova in 3D, in daylight: relief, sea, roads, towns, forests and
 * landmarks, with each district's state shown as a tint on its ground (a
 * dangerous one breathes). Labels are HTML (CSS2D) so the React side can
 * translate them and they stay sharp.
 */

export const STATUS_COLORS: Readonly<Record<ZoneStatusId, string>> = {
  SAFE: "#2fae7a",
  WATCH: "#3f8fd9",
  WARNING: "#f29d2a",
  DANGER: "#e5484d",
};

export interface SceneCallbacks {
  readonly onSelectZone: (zone: CityZoneId | null) => void;
  readonly onSelectPlace: (index: number) => void;
}

const SKY_TOP = new Color("#7fa9dc");
const HAZE = new Color("#dfe8ef");

function skyTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, `#${SKY_TOP.getHexString()}`);
    gradient.addColorStop(0.62, "#c4d7ea");
    gradient.addColorStop(1, `#${HAZE.getHexString()}`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export class CityMapScene {
  private readonly renderer: WebGLRenderer;
  private readonly labels = new CSS2DRenderer();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.1, 220);
  private readonly controls: OrbitControls;
  private readonly terrain: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly heightAt: (x: number, y: number) => number;
  private readonly roads: RoadSegment[] = buildRoadNetwork();
  private readonly time = { value: 0 };
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly zoneLabels = new Map<CityZoneId, HTMLDivElement>();
  private readonly placeLabels: HTMLDivElement[] = [];
  private readonly placeObjects: CSS2DObject[] = [];
  private readonly homeLabel: CSS2DObject;
  private readonly homeElement = document.createElement("div");
  private statuses = new Map<CityZoneId, ZoneStatusId>();
  private selected: CityZoneId | null = null;
  private hovered: CityZoneId | null = null;
  private highlight: readonly CityZoneId[] = [];
  private categories: ReadonlySet<PlaceKind> | null = null;
  private frame = 0;
  private downAt = { x: 0, y: 0 };
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: SceneCallbacks,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.domElement.className = "block size-full touch-none";
    container.appendChild(this.renderer.domElement);
    this.labels.domElement.className = "pointer-events-none absolute inset-0 overflow-hidden";
    container.appendChild(this.labels.domElement);

    this.scene.background = skyTexture();
    this.scene.fog = new Fog(HAZE, 30, 75);
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const sun = new DirectionalLight("#fff3df", 3.1);
    sun.position.set(-16, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 1, far: 70 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, new HemisphereLight("#d6e6ff", "#6e5c46", 0.95));

    const { geometry, heightAt } = buildTerrain(360, 252);
    this.heightAt = heightAt;
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 });
    this.patchTerrain(material);
    this.terrain = new Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    this.scene.add(this.terrain);

    this.addWater(sun.position);
    this.addRoads();
    this.addBorders();
    this.addTowns();
    this.addVegetation();
    this.addPlaceLabels();
    this.addZoneLabels();

    this.homeElement.className = "tn-map-home";
    for (const part of ["tn-map-home-halo", "tn-map-home-dot"]) {
      const span = document.createElement("span");
      span.className = part;
      this.homeElement.appendChild(span);
    }
    this.homeLabel = new CSS2DObject(this.homeElement);
    this.homeLabel.visible = false;
    this.scene.add(this.homeLabel);

    this.camera.position.set(0, 9.5, 12.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = 1.32;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(0, 0, 0.6);
    this.controls.addEventListener("change", () => {
      const t = this.controls.target;
      t.x = Math.max(-11, Math.min(11, t.x));
      t.z = Math.max(-8, Math.min(8, t.z));
      this.updateLabelVisibility();
    });

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.updateLabelVisibility();
    this.start();
  }

  /** Ground detail (grain, rock on slopes) plus the per-district tint. */
  private patchTerrain(material: MeshStandardMaterial): void {
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 aTint;\nvarying vec4 vTint;\nvarying vec3 vWorld;\nvarying vec3 vUp;")
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvUp = normalize(mat3(modelMatrix) * objectNormal);\nvTint = aTint;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uTime;
          varying vec4 vTint;
          varying vec3 vWorld;
          varying vec3 vUp;
          float tnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float tnNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(tnHash(i), tnHash(i + vec2(1, 0)), f.x), mix(tnHash(i + vec2(0, 1)), tnHash(i + vec2(1, 1)), f.x), f.y);
          }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          // Fine ground texture at two scales, so close-ups never look flat.
          float tnGrain = tnNoise(vWorld.xz * 9.0) * 0.6 + tnNoise(vWorld.xz * 37.0) * 0.4;
          diffuseColor.rgb *= 0.86 + 0.24 * tnGrain;
          // Steep slopes show bare rock.
          float tnSlope = 1.0 - clamp(vUp.y, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.40, 0.38) * (0.85 + 0.3 * tnGrain), smoothstep(0.28, 0.6, tnSlope));
          // District state: a tint, breathing when the alpha marks danger.
          float tnPulse = vTint.a > 0.5 ? 0.7 + 0.3 * sin(uTime * 2.6) : 1.0;
          float tnStrength = vTint.a > 0.5 ? (vTint.a - 0.5) * 2.0 : vTint.a;
          diffuseColor.rgb = mix(diffuseColor.rgb, vTint.rgb, tnStrength * tnPulse);`,
        );
    };
    material.customProgramCacheKey = () => "tn-city-terrain-v2";
  }

  private addWater(sunPosition: Vector3): void {
    const geometry = new PlaneGeometry(90, 66, 220, 160);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute("position") as BufferAttribute;
    const shallow = new Float32Array(position.count);
    for (let i = 0; i < position.count; i += 1) {
      const { x, y } = toMap(position.getX(i), position.getZ(i));
      const ground = this.heightAt(Math.max(-150, Math.min(1150, x)), Math.max(-150, Math.min(790, y)));
      // 1 at the shore, 0 in deep water.
      shallow[i] = Math.max(0, Math.min(1, 1 + ground / 0.32));
    }
    geometry.setAttribute("aShallow", new Float32BufferAttribute(shallow, 1));
    const water = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        uniforms: {
          uTime: this.time,
          uSun: { value: sunPosition.clone().normalize() },
          uDeep: { value: new Color("#0d4a6b") },
          uShallow: { value: new Color("#3fa7b5") },
          uSky: { value: new Color("#cfe0f0") },
          fogColor: { value: HAZE },
          fogNear: { value: 30 },
          fogFar: { value: 75 },
        },
        fog: true,
        transparent: true,
      }),
    );
    water.position.y = -0.002;
    this.scene.add(water);
  }

  /** Asphalt ribbons draped on the relief; arterials are wider and have a light centre line. */
  private addRoads(): void {
    const asphalt: number[] = [];
    const markings: number[] = [];
    const addRibbon = (target: number[], ax: number, ay: number, bx: number, by: number, width: number, lift: number) => {
      const length = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(length / 3));
      const nx = -(by - ay) / length;
      const ny = (bx - ax) / length;
      const half = width / 2;
      const point = (t: number, side: number) => {
        const x = ax + (bx - ax) * t + nx * half * side;
        const y = ay + (by - ay) * t + ny * half * side;
        const world = toWorld(x, y);
        return [world.x, Math.max(0.01, this.heightAt(x, y)) + lift, world.z];
      };
      for (let s = 0; s < steps; s += 1) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const a = point(t0, -1);
        const b = point(t0, 1);
        const c = point(t1, -1);
        const d = point(t1, 1);
        target.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
    };
    for (const road of this.roads) {
      addRibbon(asphalt, road.a[0], road.a[1], road.b[0], road.b[1], road.major ? 6.5 : 3.6, 0.018);
      if (road.major) addRibbon(markings, road.a[0], road.a[1], road.b[0], road.b[1], 0.45, 0.022);
    }
    const build = (points: number[], color: string, roughness: number) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    build(asphalt, "#4a4d52", 0.88);
    build(markings, "#e9e3cf", 0.6);
  }

  /** District borders: soft white lines on the ground. */
  private addBorders(): void {
    const points: number[] = [];
    const seen = new Set<string>();
    for (const zone of CITY_ZONES) {
      zone.polygon.forEach((key, index) => {
        const next = zone.polygon[(index + 1) % zone.polygon.length] ?? key;
        const id = [key, next].sort().join("");
        if (seen.has(id)) return;
        seen.add(id);
        const [ax, ay] = CITY_ZONE_VERTICES[key];
        const [bx, by] = CITY_ZONE_VERTICES[next];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 5);
        for (let s = 0; s < steps; s += 2) {
          for (const t of [s / steps, (s + 1) / steps]) {
            const x = ax + (bx - ax) * t;
            const y = ay + (by - ay) * t;
            const world = toWorld(x, y);
            points.push(world.x, Math.max(0.01, this.heightAt(x, y)) + 0.03, world.z);
          }
        }
      });
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
    this.scene.add(new LineSegments(geometry, new LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 })));
  }

  /** Facades with windows drawn by the shader, from the world position: no textures to load. */
  private buildingMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, metalness: 0.1, envMapIntensity: 0.6 });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vBWorld;\nvarying vec3 vBNormal;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvBWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\nvBNormal = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vBWorld;\nvarying vec3 vBNormal;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          if (vBNormal.y < 0.5) {
            float tnAlong = abs(vBNormal.x) > abs(vBNormal.z) ? vBWorld.z : vBWorld.x;
            vec2 tnCell = fract(vec2(tnAlong * 55.0, vBWorld.y * 70.0));
            float tnWindow = step(0.22, tnCell.x) * step(tnCell.x, 0.78) * step(0.25, tnCell.y) * step(tnCell.y, 0.75);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.22, 0.3), tnWindow * 0.65);
          } else {
            diffuseColor.rgb *= 0.82;
          }`,
        );
    };
    material.customProgramCacheKey = () => "tn-city-buildings";
    return material;
  }

  /** Houses around every landmark, downtown towers in Nova Prime, hangars at the spaceport. */
  private addTowns(): void {
    const box = new BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const maxCount = 2600;
    const buildings = new InstancedMesh(box, this.buildingMaterial(), maxCount);
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    const dummy = new Object3D();
    const facades = ["#d9d2c5", "#c8c1b4", "#a9b0b8", "#8f9aa5", "#b8a58b", "#9fa6ad", "#cfc6b6", "#7d8894"].map((value) => new Color(value));
    let count = 0;
    const place = (x: number, y: number, width: number, depth: number, height: number, angle: number) => {
      if (count >= maxCount) return;
      const ground = this.heightAt(x, y);
      if (ground < 0.02) return;
      const world = toWorld(x, y);
      dummy.position.set(world.x, ground - 0.01, world.z);
      dummy.scale.set(width, height, depth);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      buildings.setMatrixAt(count, dummy.matrix);
      buildings.setColorAt(count, facades[Math.floor(Math.random() * facades.length)] ?? facades[0]!);
      count += 1;
    };

    // Downtown: a dense grid of towers, tallest at the centre of Nova Prime.
    const capital = CITY_ZONES.find((zone) => zone.id === "NOVA_PRIME");
    if (capital) {
      const [cx, cy] = zoneCentroid(capital);
      for (let gx = -150; gx <= 150; gx += 9) {
        for (let gy = -90; gy <= 90; gy += 9) {
          const x = cx + gx + (Math.random() - 0.5) * 3;
          const y = cy + gy + (Math.random() - 0.5) * 3;
          if (zoneAt(x, y) !== "NOVA_PRIME" || distanceToRoads(this.roads, x, y) < 5 || Math.random() < 0.18) continue;
          const core = Math.max(0, 1 - Math.hypot(gx, gy * 1.4) / 170);
          const height = 0.12 + Math.pow(Math.random(), 1.6) * 1.35 * core * core + 0.08 * core;
          place(x, y, 0.1 + Math.random() * 0.06, 0.1 + Math.random() * 0.06, height, 0);
        }
      }
    }
    // Neighbourhoods: low houses clustered around each landmark, off the roads.
    for (const landmark of CITY_PLACES) {
      const cluster = landmark.zone === "NOVA_PRIME" ? 0 : 38;
      for (let i = 0; i < cluster; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 6 + Math.pow(Math.random(), 0.7) * 26;
        const x = landmark.x + Math.cos(angle) * radius;
        const y = landmark.y + Math.sin(angle) * radius;
        if (distanceToRoads(this.roads, x, y) < 3.5 || zoneAt(x, y) !== landmark.zone) continue;
        const tall = landmark.kind === "STAY" && i < 3;
        place(x, y, 0.06 + Math.random() * 0.05, 0.06 + Math.random() * 0.05, tall ? 0.2 + Math.random() * 0.2 : 0.04 + Math.random() * 0.06, Math.random() * Math.PI);
      }
    }
    // Spaceport hangars.
    for (const [x, y] of [[790, 400], [770, 420], [805, 372]] as const) place(x, y, 0.42, 0.26, 0.12, 0.4);
    buildings.count = count;
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    this.scene.add(buildings);

    // A launch tower at the spaceport, the city's landmark on the skyline.
    const tower = new Mesh(new CylinderGeometry(0.03, 0.05, 1.1, 12), new MeshStandardMaterial({ color: "#d9dde2", metalness: 0.6, roughness: 0.3 }));
    const towerWorld = toWorld(822, 392);
    tower.position.set(towerWorld.x, this.heightAt(822, 392) + 0.55, towerWorld.z);
    tower.castShadow = true;
    this.scene.add(tower);
  }

  /** Forests, mangroves, rocks and snowfields, scattered by district. */
  private addVegetation(): void {
    const crown = mergeGeometries([new ConeGeometry(0.5, 1.3, 7).translate(0, 1.15, 0), new CylinderGeometry(0.09, 0.12, 0.6, 5).translate(0, 0.3, 0)]);
    const round = new IcosahedronGeometry(0.55, 0);
    round.translate(0, 0.75, 0);
    const rock = new DodecahedronGeometry(0.5, 0);
    const greens = ["#24452a", "#2c5130", "#365c33", "#1f3d24", "#3f6438"].map((value) => new Color(value));
    const dummy = new Object3D();

    const scatter = (geometry: BufferGeometry, color: string, count: number, zones: readonly CityZoneId[], size: [number, number], colors?: Color[]) => {
      const mesh = new InstancedMesh(geometry, new MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }), count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      let placed = 0;
      let guard = 0;
      while (placed < count && guard < count * 30) {
        guard += 1;
        const x = 60 + Math.random() * 880;
        const y = 80 + Math.random() * 480;
        const zone = zoneAt(x, y);
        if (!zone || !zones.includes(zone)) continue;
        const ground = this.heightAt(x, y);
        if (ground < 0.04 || distanceToRoads(this.roads, x, y) < 4) continue;
        if (CITY_PLACES.some((landmark) => Math.hypot(landmark.x - x, landmark.y - y) < 14)) continue;
        const world = toWorld(x, y);
        const scale = size[0] + Math.random() * (size[1] - size[0]);
        dummy.position.set(world.x, ground - 0.01, world.z);
        dummy.scale.setScalar(scale);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        if (colors) mesh.setColorAt(placed, colors[Math.floor(Math.random() * colors.length)] ?? colors[0]!);
        placed += 1;
      }
      mesh.count = placed;
      this.scene.add(mesh);
    };

    scatter(crown, "#ffffff", 2200, ["VERDANT_BASIN", "CRYSTAL_REACH"], [0.05, 0.1], greens);
    scatter(round, "#ffffff", 1200, ["SUNKEN_DELTA", "VERDANT_BASIN", "SKYPORT_ISLES"], [0.05, 0.09], greens);
    scatter(rock, "#4b3a33", 420, ["EMBER_WASTES", "OBSIDIAN_COAST"], [0.04, 0.1]);
    scatter(rock, "#8c949a", 300, ["FROSTPEAK", "CRYSTAL_REACH"], [0.05, 0.12]);
  }

  private addPlaceLabels(): void {
    CITY_PLACES.forEach((landmark, index) => {
      const element = document.createElement("div");
      element.className = "tn-map-place";
      element.dataset.kind = landmark.kind;
      this.placeLabels.push(element);
      const object = new CSS2DObject(element);
      const world = toWorld(landmark.x, landmark.y);
      object.position.set(world.x, this.heightAt(landmark.x, landmark.y) + 0.12, world.z);
      object.userData.index = index;
      this.placeObjects.push(object);
      this.scene.add(object);
    });
  }

  private addZoneLabels(): void {
    for (const zone of CITY_ZONES) {
      const [x, y] = zoneCentroid(zone);
      const world = toWorld(x, y);
      const element = document.createElement("div");
      element.className = "tn-map-zone";
      this.zoneLabels.set(zone.id, element);
      const label = new CSS2DObject(element);
      label.position.set(world.x, this.heightAt(x, y) + 0.7, world.z);
      this.scene.add(label);
    }
  }

  /** Place labels only when close enough to read them, like any good map. */
  private updateLabelVisibility(): void {
    const distance = this.camera.position.distanceTo(this.controls?.target ?? new Vector3());
    this.placeObjects.forEach((object, index) => {
      const kind = CITY_PLACES[index]?.kind;
      const allowed = !this.categories || (kind ? this.categories.has(kind) : false);
      object.visible = allowed && (distance < 17 || this.categories !== null);
    });
    for (const [, element] of this.zoneLabels) element.style.opacity = distance < 6 ? "0" : "1";
  }

  zoneLabelElement(zone: CityZoneId): HTMLDivElement | undefined {
    return this.zoneLabels.get(zone);
  }

  placeLabelElement(index: number): HTMLDivElement | undefined {
    return this.placeLabels[index];
  }

  setStatuses(statuses: ReadonlyMap<CityZoneId, ZoneStatusId>): void {
    this.statuses = new Map(statuses);
    this.paintTints();
  }

  setHome(zone: CityZoneId | null): void {
    const definition = CITY_ZONES.find((item) => item.id === zone);
    if (!definition) {
      this.homeLabel.visible = false;
      return;
    }
    const [x, y] = zoneCentroid(definition);
    const world = toWorld(x + 14, y + 16);
    this.homeLabel.position.set(world.x, Math.max(0.02, this.heightAt(x + 14, y + 16)) + 0.05, world.z);
    this.homeLabel.visible = true;
  }

  setHighlight(zones: readonly CityZoneId[]): void {
    this.highlight = zones;
    this.paintTints();
  }

  setCategories(kinds: ReadonlySet<PlaceKind> | null): void {
    this.categories = kinds;
    this.updateLabelVisibility();
  }

  selectZone(zone: CityZoneId | null, fly = true): void {
    this.selected = zone;
    this.paintTints();
    if (!fly) return;
    const definition = CITY_ZONES.find((item) => item.id === zone);
    const [x, y] = definition ? zoneCentroid(definition) : [500, 340];
    this.flyTo(x, y, definition ? 8.5 : 19.5);
  }

  flyToPlace(index: number): void {
    const landmark = CITY_PLACES[index];
    if (landmark) this.flyTo(landmark.x, landmark.y, 4.2);
  }

  private flyTo(x: number, y: number, distance: number): void {
    const world = toWorld(x, y);
    const ground = Math.max(0, this.heightAt(x, y));
    const offset = this.camera.position.clone().sub(this.controls.target).setY(0).normalize();
    if (offset.lengthSq() === 0) offset.set(0, 0, 1);
    gsap.to(this.controls.target, { x: world.x, y: ground, z: world.z, duration: 1.3, ease: "power3.inOut" });
    gsap.to(this.camera.position, {
      x: world.x + offset.x * distance * 0.62,
      y: ground + distance * 0.78,
      z: world.z + offset.z * distance * 0.62,
      duration: 1.3,
      ease: "power3.inOut",
      onUpdate: () => this.updateLabelVisibility(),
    });
  }

  zoom(factor: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const length = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, offset.length() * factor));
    offset.setLength(length);
    const target = this.controls.target.clone().add(offset);
    gsap.to(this.camera.position, { x: target.x, y: target.y, z: target.z, duration: 0.5, ease: "power2.out", onUpdate: () => this.updateLabelVisibility() });
  }

  /** Face north again, at a comfortable tilt. */
  resetNorth(): void {
    const t = this.controls.target;
    const distance = this.camera.position.distanceTo(t);
    gsap.to(this.camera.position, { x: t.x, y: t.y + distance * 0.75, z: t.z + distance * 0.66, duration: 0.8, ease: "power2.inOut" });
  }

  /** Top-down "2D" view or tilted "3D" view. */
  setTilt(flat: boolean): void {
    const t = this.controls.target;
    const distance = this.camera.position.distanceTo(t);
    const y = flat ? distance * 0.999 : distance * 0.75;
    const z = flat ? distance * 0.04 : distance * 0.66;
    gsap.to(this.camera.position, { x: t.x, y: t.y + y, z: t.z + z, duration: 0.9, ease: "power2.inOut" });
  }

  private paintTints(): void {
    const geometry = this.terrain.geometry;
    const zones = geometry.getAttribute("aZone") as BufferAttribute;
    const tint = geometry.getAttribute("aTint") as BufferAttribute;
    const zoneColors = CITY_ZONE_IDS.map((zone) => {
      const status = this.statuses.get(zone) ?? "SAFE";
      const color = new Color(STATUS_COLORS[status]);
      // Information notices do not colour the ground; caution and danger do, lightly.
      let strength = status === "WARNING" ? 0.24 : status === "DANGER" ? 0.36 : 0;
      if (this.highlight.length > 0 && !this.highlight.includes(zone)) strength *= 0.3;
      if (this.highlight.includes(zone) && status === "SAFE") {
        color.set("#ffffff");
        strength = 0.14;
      }
      if (zone === this.hovered || zone === this.selected) {
        if (status === "SAFE") color.set("#ffffff");
        strength = Math.max(strength, zone === this.selected ? 0.24 : 0.12);
      }
      // Alpha above 0.5 tells the shader to make the tint breathe (danger only).
      return { color, alpha: status === "DANGER" ? 0.5 + strength / 2 : Math.min(0.49, strength) };
    });
    for (let i = 0; i < zones.count; i += 1) {
      const entry = zoneColors[zones.getX(i)];
      if (entry) tint.setXYZW(i, entry.color.r, entry.color.g, entry.color.b, entry.alpha);
      else tint.setXYZW(i, 0, 0, 0, 0);
    }
    tint.needsUpdate = true;
  }

  private pick(event: PointerEvent): { zone: CityZoneId | null } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.terrain, false)[0];
    if (!hit) return { zone: null };
    const { x, y } = toMap(hit.point.x, hit.point.z);
    return { zone: zoneAt(x, y) };
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.downAt = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.downAt.x, event.clientY - this.downAt.y) > 6) return;
    this.callbacks.onSelectZone(this.pick(event).zone);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.buttons) return;
    const { zone } = this.pick(event);
    if (zone === this.hovered) return;
    this.hovered = zone;
    this.renderer.domElement.style.cursor = zone ? "pointer" : "grab";
    this.paintTints();
  };

  private readonly onPointerLeave = () => {
    if (!this.hovered) return;
    this.hovered = null;
    this.paintTints();
  };

  /** Clicks on the HTML place pins (the labels layer ignores pointer events otherwise). */
  bindPlaceClicks(): void {
    this.placeLabels.forEach((element, index) => {
      element.addEventListener("click", () => this.callbacks.onSelectPlace(index));
    });
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labels.setSize(width, height);
  }

  private start(): void {
    const loop = (now: number) => {
      // Browsers already pause animation frames in hidden tabs.
      this.frame = requestAnimationFrame(loop);
      this.time.value = now / 1000;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    };
    this.frame = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.controls.dispose();
    this.scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.geometry) return;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material?.dispose();
    });
    (this.scene.background as CanvasTexture | null)?.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    canvas.remove();
    this.labels.domElement.remove();
  }
}
