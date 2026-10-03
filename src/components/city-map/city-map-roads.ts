import { CITY_PLACES } from "@/modules/alerts/city-map-data";
import { CITY_ZONES, zoneCentroid } from "@/modules/alerts/city-zones";

/**
 * The road network: a minimum spanning tree between landmarks and district
 * centres (the arterial roads, always connected), plus links to each node's
 * two nearest neighbours (local streets). Same rule as the city's 2D map.
 */
export interface RoadSegment {
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly major: boolean;
}

export function buildRoadNetwork(): RoadSegment[] {
  const nodes: (readonly [number, number])[] = [
    ...CITY_ZONES.map((zone) => zoneCentroid(zone)),
    ...CITY_PLACES.map((place) => [place.x, place.y] as const),
  ];
  const distance = (i: number, j: number) => Math.hypot((nodes[i]?.[0] ?? 0) - (nodes[j]?.[0] ?? 0), (nodes[i]?.[1] ?? 0) - (nodes[j]?.[1] ?? 0));
  const edges = new Map<string, RoadSegment>();
  const add = (i: number, j: number, major: boolean) => {
    const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
    const existing = edges.get(key);
    if (existing) {
      if (major && !existing.major) edges.set(key, { ...existing, major: true });
      return;
    }
    edges.set(key, { a: nodes[i] ?? [0, 0], b: nodes[j] ?? [0, 0], major });
  };

  const inTree = [0];
  const rest = new Set(nodes.map((_, index) => index).slice(1));
  while (rest.size > 0) {
    let best: [number, number, number] = [Infinity, 0, 0];
    for (const i of inTree) {
      for (const j of rest) {
        const d = distance(i, j);
        if (d < best[0]) best = [d, i, j];
      }
    }
    add(best[1], best[2], true);
    inTree.push(best[2]);
    rest.delete(best[2]);
  }
  nodes.forEach((_, i) => {
    nodes
      .map((__, j) => j)
      .filter((j) => j !== i)
      .sort((x, y) => distance(i, x) - distance(i, y))
      .slice(0, 2)
      .forEach((j) => add(i, j, false));
  });
  return [...edges.values()];
}

/** Distance from a point to the nearest road, to keep trees and houses off the asphalt. */
export function distanceToRoads(roads: readonly RoadSegment[], x: number, y: number): number {
  let best = Infinity;
  for (const road of roads) {
    const [ax, ay] = road.a;
    const [bx, by] = road.b;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}
