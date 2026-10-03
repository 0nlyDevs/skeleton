import { PerspectiveCamera, Scene, Vector3 } from "three";

import { Atmosphere } from "./atmosphere";
import { CameraRail, TOUR_STOPS } from "./camera-rail";
import type { NoiseField } from "./noise";
import { buildCity, type WorldCity } from "./world-city";
import { buildSky, type WorldSky } from "./world-sky";
import { buildWorldTerrain, toWorld, type WorldTerrain } from "./world-terrain";
import { buildWater, type WorldWater } from "./world-water";

export interface WorldQuality {
  /** Terrain grid columns; rows follow the map's proportions. */
  readonly terrain: number;
  /** Shadow map size in pixels, 0 for no shadows. */
  readonly shadows: number;
}

export interface WorldView {
  /** Position on the tour, 0 … `rail.last`. */
  readonly tour: number;
  /** 1 = still falling through the clouds, 0 = on the tour. */
  readonly entry: number;
  readonly shake: number;
  readonly pointerX: number;
  readonly pointerY: number;
}

const BASE_FOV = 40;

/**
 * The island as one scene: ground, sea, sky, city and the camera that flies
 * over it. `update` places everything for one frame from a tour position.
 */
export class WorldScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(BASE_FOV, 1, 0.03, 900);
  readonly atmosphere: Atmosphere;
  readonly rail: CameraRail;
  /** Where the current stop's landmark is on screen (0 … 1 from the top left). */
  readonly anchor = { x: 0, y: 0, visible: false };

  private readonly terrain: WorldTerrain;
  private readonly water: WorldWater;
  private readonly sky: WorldSky;
  private readonly city: WorldCity;
  private readonly eye = new Vector3();
  private readonly look = new Vector3();
  private readonly back = new Vector3();
  private readonly focus = new Vector3();
  private readonly shadowKey = new Vector3(1e9, 0, 0);
  private readonly shadowLight = new Vector3();
  private shadowReach = 0;
  private shadowAge = 4;
  private roll = 0;
  private heading = 0;
  private portrait = 1;

  /** Builds the island in steps, giving the page a frame between each. */
  static async build(quality: WorldQuality, noise: NoiseField, onStep: (done: number) => void): Promise<WorldScene> {
    const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const atmosphere = new Atmosphere(noise.texture);
    onStep(0.15);
    await pause();
    const terrain = buildWorldTerrain(atmosphere, quality.terrain, Math.round(quality.terrain * 0.7));
    onStep(0.6);
    await pause();
    const water = buildWater(atmosphere, terrain);
    const sky = buildSky(atmosphere);
    onStep(0.7);
    await pause();
    const city = buildCity(terrain, atmosphere, noise);
    onStep(1);
    await pause();
    return new WorldScene(quality, atmosphere, terrain, water, sky, city);
  }

  private constructor(quality: WorldQuality, atmosphere: Atmosphere, terrain: WorldTerrain, water: WorldWater, sky: WorldSky, city: WorldCity) {
    this.atmosphere = atmosphere;
    this.terrain = terrain;
    this.water = water;
    this.sky = sky;
    this.city = city;
    this.rail = new CameraRail(terrain);

    const sun = atmosphere.sun;
    if (quality.shadows > 0) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadows, quality.shadows);
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.035;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 90;
      // Redrawn only when the light or the view has moved enough to show.
      sun.shadow.autoUpdate = false;
    }
    this.scene.add(sky.group, terrain.mesh, water.mesh, city.group, sun, sun.target, atmosphere.hemisphere);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    // On a tall screen the view widens, so the island still fits.
    this.portrait = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.55 : 1;
    this.applyFov(0);
  }

  private applyFov(entry: number): void {
    this.camera.fov = Math.min(86, BASE_FOV * this.portrait + entry * 16);
    this.camera.updateProjectionMatrix();
  }

  /** Lamps are drawn in screen pixels: they need the size of the drawing in real pixels. */
  setDrawHeight(pixels: number): void {
    this.city.setPixels(pixels / (2 * Math.tan((this.camera.fov * Math.PI) / 360)));
  }

  update(view: WorldView, time: number, dt: number): void {
    const { eye, look, camera } = this;
    this.rail.sample(view.tour, eye, look);

    // Arriving: higher and further back, falling towards the first view.
    if (view.entry > 0.0001) {
      const fall = view.entry * view.entry;
      this.back.subVectors(eye, look).setY(0).normalize();
      eye.addScaledVector(this.back, fall * 3.4);
      eye.y += fall * 4.4;
      look.y -= view.entry * 0.5;
    }
    this.applyFov(view.entry);

    // A hand on the camera: slow drift, a little of the pointer, the shake of entry.
    const drift = 0.012;
    eye.x += Math.sin(time * 0.31) * drift + (Math.sin(time * 37.1) + Math.sin(time * 23.7)) * view.shake * 0.035;
    eye.y += Math.sin(time * 0.23 + 1.7) * drift * 0.6 + Math.sin(time * 41.3) * view.shake * 0.04;
    eye.z += Math.cos(time * 0.27) * drift;
    camera.position.copy(eye);
    camera.lookAt(look);
    camera.rotateY(-view.pointerX * 0.045);
    camera.rotateX(-view.pointerY * 0.03);

    // Bank into turns.
    const heading = Math.atan2(look.x - eye.x, look.z - eye.z);
    let turn = heading - this.heading;
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    this.heading = heading;
    const bank = Math.max(-0.16, Math.min(0.16, (turn / Math.max(dt, 0.001)) * 0.22));
    this.roll += (bank - this.roll) * Math.min(1, dt * 2.5);
    camera.rotateZ(this.roll + Math.sin(time * 0.19) * 0.004);

    this.projectAnchor(view.tour);
    this.atmosphere.update(this.rail.sol(view.tour), time);
    this.sky.follow(camera);
    this.city.update(time);
    this.updateShadows();
  }

  private projectAnchor(tour: number): void {
    const nearest = Math.round(tour);
    const pose = TOUR_STOPS[nearest]?.anchor;
    this.anchor.visible = false;
    if (!pose || Math.abs(tour - nearest) > 0.4) return;
    const at = toWorld(pose[0], pose[1]);
    this.camera.updateMatrixWorld();
    this.focus.set(at.x, Math.max(0, this.terrain.heightAt(pose[0], pose[1])) + pose[2], at.z).project(this.camera);
    this.anchor.x = this.focus.x * 0.5 + 0.5;
    this.anchor.y = 0.5 - this.focus.y * 0.5;
    this.anchor.visible = this.focus.z < 1 && this.anchor.x > 0.04 && this.anchor.x < 0.96 && this.anchor.y > 0.08 && this.anchor.y < 0.92;
  }

  private updateShadows(): void {
    const sun = this.atmosphere.sun;
    if (!sun.castShadow) return;
    const reach = Math.min(9, 3 + this.eye.y * 1.7);
    this.focus.copy(this.eye).lerp(this.look, 0.62).setY(0);
    const light = this.atmosphere.lightDirection;
    // While the camera flies, the shadow map is redrawn every few frames at most: it is the costliest pass.
    this.shadowAge += 1;
    const moved = this.focus.distanceToSquared(this.shadowKey) > 0.05 || light.distanceToSquared(this.shadowLight) > 0.0002 || Math.abs(reach - this.shadowReach) > 0.3;
    if (!moved || this.shadowAge < 4) return;
    this.shadowAge = 0;
    this.shadowKey.copy(this.focus);
    this.shadowLight.copy(light);
    this.shadowReach = reach;
    sun.target.position.copy(this.focus);
    sun.target.updateMatrixWorld();
    sun.position.copy(this.focus).addScaledVector(light, 45);
    const frame = sun.shadow.camera;
    frame.left = -reach;
    frame.right = reach;
    frame.top = reach;
    frame.bottom = -reach;
    frame.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
  }

  dispose(): void {
    this.terrain.dispose();
    this.water.dispose();
    this.sky.dispose();
    this.city.dispose();
    this.atmosphere.sun.shadow.map?.dispose();
    this.scene.clear();
  }
}
