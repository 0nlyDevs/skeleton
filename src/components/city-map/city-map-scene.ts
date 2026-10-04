import gsap from "gsap";
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { CITY_PLACES, type PlaceKind } from "@/modules/alerts/city-map-data";
import { CITY_ZONES, CITY_ZONE_IDS, CITY_ZONE_VERTICES, zoneAt, zoneCentroid, type CityZoneId, type ZoneStatusId } from "@/modules/alerts/city-zones";

import { Atmosphere } from "@/components/cinematic/stage/atmosphere";
import { createNoise } from "@/components/cinematic/stage/noise";
import { buildCity, type WorldCity } from "@/components/cinematic/stage/world-city";
import { buildSky, type WorldSky } from "@/components/cinematic/stage/world-sky";
import { buildWorldTerrain, toMap, toWorld, type WorldTerrain } from "@/components/cinematic/stage/world-terrain";
import { buildWater, type WorldWater } from "@/components/cinematic/stage/world-water";

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
  readonly onSelectService: (slug: string) => void;
}

/** A municipal service with premises, as the map needs it. */
export interface MapServicePoint {
  readonly slug: string;
  readonly x: number;
  readonly y: number;
  readonly emergency: boolean;
}

/** Which services show: every one, only emergency facilities, or none. */
export type ServiceLayer = "all" | "emergency" | "none";

export class CityMapScene {
  private readonly renderer: WebGLRenderer;
  private readonly labels = new CSS2DRenderer();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.05, 900);
  private readonly controls: OrbitControls;
  private readonly terrain: Mesh;
  private readonly world: WorldTerrain;
  private readonly water: WorldWater;
  private readonly sky: WorldSky;
  private readonly city: WorldCity;
  private readonly atmosphere: Atmosphere;
  private tintMaterial!: ShaderMaterial;
  /** Time of day on the landing's scale: 0.42 is noon, 0.83 dusk with the city lit. */
  private sol = 0.42;
  private readonly heightAt: (x: number, y: number) => number;
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
  private readonly serviceObjects = new Map<string, { object: CSS2DObject; element: HTMLDivElement; point: MapServicePoint }>();
  private serviceLayer: ServiceLayer = "all";
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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.className = "block size-full touch-none";
    container.appendChild(this.renderer.domElement);
    // Its own stacking context: CSS2D gives each label a z-index, which must not climb over the map controls.
    this.labels.domElement.className = "pointer-events-none absolute inset-0 isolate z-0 overflow-hidden";
    container.appendChild(this.labels.domElement);

    // The same island as the landing: one atmosphere, ground, sea, sky and city.
    const noise = createNoise();
    this.atmosphere = new Atmosphere(noise.texture);
    this.atmosphere.update(this.sol, 0);
    const world = buildWorldTerrain(this.atmosphere, 360, 252);
    this.world = world;
    this.water = buildWater(this.atmosphere, world);
    this.sky = buildSky(this.atmosphere);
    this.city = buildCity(world, this.atmosphere, noise);
    this.heightAt = world.heightAt;
    this.terrain = world.mesh;
    this.scene.add(this.sky.group, world.mesh, this.water.mesh, this.city.group, this.atmosphere.sun, this.atmosphere.sun.target, this.atmosphere.hemisphere);
    this.addTintOverlay();

    this.addBorders();
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
    // Emergency facilities stay visible at every zoom; other services appear closer in or on demand.
    for (const { object, point } of this.serviceObjects.values()) {
      object.visible =
        this.serviceLayer === "emergency" ? point.emergency : this.serviceLayer === "all" && (point.emergency || distance < 22);
    }
  }

  /** Creates one pin per service (React fills it with the translated content). */
  setServices(points: readonly MapServicePoint[]): ReadonlyMap<string, HTMLDivElement> {
    for (const { object } of this.serviceObjects.values()) this.scene.remove(object);
    this.serviceObjects.clear();
    for (const point of points) {
      const element = document.createElement("div");
      element.className = point.emergency ? "tn-map-service is-emergency" : "tn-map-service";
      element.addEventListener("click", () => this.callbacks.onSelectService(point.slug));
      const object = new CSS2DObject(element);
      const world = toWorld(point.x, point.y);
      object.position.set(world.x, Math.max(0.05, this.heightAt(point.x, point.y)) + 0.14, world.z);
      this.scene.add(object);
      this.serviceObjects.set(point.slug, { object, element, point });
    }
    this.updateLabelVisibility();
    return new Map([...this.serviceObjects].map(([slug, entry]) => [slug, entry.element]));
  }

  setServiceLayer(layer: ServiceLayer): void {
    this.serviceLayer = layer;
    this.updateLabelVisibility();
  }

  flyToService(slug: string): void {
    const entry = this.serviceObjects.get(slug);
    if (entry) this.flyTo(entry.point.x, entry.point.y, 4.4);
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

  /**
   * District state as a veil draped over the landing's ground: the same mesh,
   * lifted a hair, drawn with each vertex's tint (a dangerous district breathes).
   */
  private addTintOverlay(): void {
    const geometry = this.terrain.geometry;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const zones = new Float32Array(position.count);
    for (let i = 0; i < position.count; i += 1) {
      const { x, y } = toMap(position.getX(i), position.getZ(i));
      const zone = zoneAt(x, y);
      zones[i] = zone ? CITY_ZONE_IDS.indexOf(zone) : -1;
    }
    geometry.setAttribute("aZone", new BufferAttribute(zones, 1));
    geometry.setAttribute("aTint", new BufferAttribute(new Float32Array(position.count * 4), 4));
    this.tintMaterial = new ShaderMaterial({
      uniforms: { uTime: this.time },
      vertexShader: `
        attribute vec4 aTint;
        varying vec4 vTint;
        void main() {
          vTint = aTint;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * 0.012, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec4 vTint;
        void main() {
          float pulse = vTint.a > 0.5 ? 0.7 + 0.3 * sin(uTime * 2.6) : 1.0;
          float strength = vTint.a > 0.5 ? (vTint.a - 0.5) * 2.0 : vTint.a;
          gl_FragColor = vec4(vTint.rgb, strength * pulse * 0.85);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const veil = new Mesh(geometry, this.tintMaterial);
    veil.renderOrder = 2;
    this.scene.add(veil);
  }

  /** Day for the light theme, dusk with the city lit for the dark one. */
  setDaylight(dark: boolean): void {
    this.sol = dark ? 0.83 : 0.42;
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
    // Lamps are drawn in screen pixels: they need the size of the drawing in real pixels.
    this.city.setPixels((height * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360)));
  }

  private start(): void {
    const loop = (now: number) => {
      // Browsers already pause animation frames in hidden tabs.
      this.frame = requestAnimationFrame(loop);
      this.time.value = now / 1000;
      this.controls.update();
      this.atmosphere.update(this.sol, now / 1000);
      this.renderer.toneMappingExposure = this.atmosphere.exposure;
      this.sky.follow(this.camera);
      this.city.update(now / 1000);
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
    this.world.dispose();
    this.water.dispose();
    this.sky.dispose();
    this.city.dispose();
    this.tintMaterial.dispose();
    this.renderer.dispose();
    canvas.remove();
    this.labels.domElement.remove();
  }
}
