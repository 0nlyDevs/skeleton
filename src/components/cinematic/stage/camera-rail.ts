import { CatmullRomCurve3, Vector3 } from "three";

import type { CityZoneId } from "@/modules/alerts/city-zones";

import { toWorld, type WorldTerrain } from "./world-terrain";

/**
 * The flight over the island. Each stop is a place the page talks about: where
 * the camera is, what it looks at, and the hour (`sol`, 0 = dawn, 1 = night).
 * Positions are on the 1000 × 640 city map, altitudes in world units. The
 * flight goes around the island clockwise, from the Skyport at sunrise to the
 * southern sea at night.
 */
type Pose = readonly [mapX: number, mapY: number, altitude: number];

export interface TourStop {
  readonly id: string;
  readonly zone: CityZoneId | null;
  readonly eye: Pose;
  readonly look: Pose;
  readonly sol: number;
  /** The landmark the section's panel points at: a map position and a height above its ground. */
  readonly anchor?: Pose;
  /** Where the camera passes half-way to the next stop, when a straight line would look wrong. */
  readonly via?: { readonly eye: Pose; readonly look: Pose };
}

export const TOUR_STOPS: readonly TourStop[] = [
  { id: "arrival", zone: null, eye: [590, 672, 0.4], look: [772, 396, 0.5], sol: 0 },
  { id: "skyport", zone: "SKYPORT_ISLES", eye: [700, 470, 0.95], look: [786, 380, 0.42], sol: 0.1, anchor: [800, 362, 0.34] },
  { id: "nova", zone: "NOVA_PRIME", eye: [604, 396, 0.78], look: [466, 294, 0.3], sol: 0.24, anchor: [430, 290, 0.98] },
  { id: "delta", zone: "SUNKEN_DELTA", eye: [338, 366, 0.5], look: [208, 442, 0.02], sol: 0.38, anchor: [200, 424, 0.07] },
  { id: "crystal", zone: "CRYSTAL_REACH", eye: [246, 250, 1.7], look: [200, 204, 1.5], sol: 0.5, anchor: [200, 200, 0.14] },
  {
    id: "verdant",
    zone: "VERDANT_BASIN",
    eye: [330, 228, 1.2],
    look: [410, 150, 0.3],
    sol: 0.62,
    anchor: [380, 130, 0.18],
    via: { eye: [560, 140, 1.25], look: [690, 200, 0.8] },
  },
  { id: "frost", zone: "FROSTPEAK", eye: [618, 128, 1.35], look: [796, 226, 0.95], sol: 0.74, anchor: [800, 190, 0.2] },
  {
    id: "ember",
    zone: "EMBER_WASTES",
    eye: [770, 196, 1.1],
    look: [650, 186, 0.6],
    sol: 0.868,
    anchor: [720, 190, 0.17],
    via: { eye: [640, 380, 1.2], look: [500, 310, 0.45] },
  },
  { id: "coast", zone: "OBSIDIAN_COAST", eye: [476, 706, 1.25], look: [552, 300, 1.55], sol: 1 },
];

function point(pose: Pose): Vector3 {
  const world = toWorld(pose[0], pose[1]);
  return new Vector3(world.x, pose[2], world.z);
}

function ease(value: number): number {
  // Slows down around each stop, so a section can be read while the view settles.
  const smooth = value * value * (3 - 2 * value);
  return value + (smooth - value) * 0.72;
}

export class CameraRail {
  readonly last = TOUR_STOPS.length - 1;
  private readonly eyes: CatmullRomCurve3;
  private readonly looks: CatmullRomCurve3;

  constructor(private readonly terrain: WorldTerrain) {
    const eyes: Vector3[] = [];
    const looks: Vector3[] = [];
    TOUR_STOPS.forEach((stop, index) => {
      const eye = point(stop.eye);
      const look = point(stop.look);
      eyes.push(eye);
      looks.push(look);
      const next = TOUR_STOPS[index + 1];
      if (!next) return;
      eyes.push(stop.via ? point(stop.via.eye) : eye.clone().lerp(point(next.eye), 0.5));
      looks.push(stop.via ? point(stop.via.look) : look.clone().lerp(point(next.look), 0.5));
    });
    this.eyes = new CatmullRomCurve3(eyes, false, "centripetal");
    this.looks = new CatmullRomCurve3(looks, false, "centripetal");
  }

  /** `tour` runs from 0 (first stop) to `last`; whole numbers are the stops. */
  sample(tour: number, eye: Vector3, look: Vector3): void {
    const t = Math.min(this.last, Math.max(0, tour));
    const whole = Math.min(this.last - 1, Math.floor(t));
    const u = (whole + ease(t - whole)) / this.last;
    this.eyes.getPoint(u, eye);
    this.looks.getPoint(u, look);
    // Never through a mountain: keep a margin above the ground below.
    const mapX = eye.x / 0.02 + 500;
    const mapY = eye.z / 0.02 + 320;
    const floor = Math.max(0, this.terrain.heightAt(mapX, mapY)) + 0.16;
    if (eye.y < floor) eye.y = floor;
  }

  /** The hour at a tour position. */
  sol(tour: number): number {
    const t = Math.min(this.last, Math.max(0, tour));
    const whole = Math.min(this.last - 1, Math.floor(t));
    const from = TOUR_STOPS[whole]?.sol ?? 0;
    const to = TOUR_STOPS[whole + 1]?.sol ?? from;
    return from + (to - from) * (t - whole);
  }
}
