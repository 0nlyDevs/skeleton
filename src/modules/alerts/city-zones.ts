/**
 * Terra Nova district and compass-region mapping, based on the supplied map.
 * These broad zones let residents choose an area without storing a street
 * address or precise device location.
 */

export const CITY_ZONE_IDS = [
  "CRYSTAL_REACH",
  "VERDANT_BASIN",
  "EMBER_WASTES",
  "FROSTPEAK",
  "SUNKEN_DELTA",
  "NOVA_PRIME",
  "OBSIDIAN_COAST",
  "SKYPORT_ISLES",
] as const;

export type CityZoneId = (typeof CITY_ZONE_IDS)[number];

export const CITY_REGION_IDS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;
export type CityRegionId = (typeof CITY_REGION_IDS)[number];

export const CITY_ALERT_SCOPES = ["ALL", ...CITY_REGION_IDS, ...CITY_ZONE_IDS] as const;
export type CityAlertScopeId = (typeof CITY_ALERT_SCOPES)[number];

export const CITY_ALERT_SEVERITIES = ["INFORMATION", "WARNING", "CRITICAL"] as const;
export type CityAlertSeverityId = (typeof CITY_ALERT_SEVERITIES)[number];

export const CITY_ZONE_VERTICES = {
  A: [120, 160],
  B: [330, 100],
  C: [560, 120],
  D: [800, 150],
  E: [900, 300],
  F: [860, 480],
  G: [640, 540],
  H: [400, 520],
  I: [180, 480],
  J: [90, 320],
  P: [330, 250],
  Q: [560, 230],
  R: [760, 260],
  S: [240, 330],
  T: [470, 370],
  U: [680, 400],
} as const;

export interface CityZoneDefinition {
  readonly id: CityZoneId;
  readonly region: CityRegionId;
  readonly polygon: readonly (keyof typeof CITY_ZONE_VERTICES)[];
  readonly description: string;
}

export const CITY_ZONES: readonly CityZoneDefinition[] = [
  { id: "CRYSTAL_REACH", region: "WEST", polygon: ["A", "B", "P", "S", "J"], description: "Quartz highlands and observatories." },
  { id: "VERDANT_BASIN", region: "NORTH", polygon: ["B", "C", "Q", "P"], description: "Farmland and canopy forests." },
  { id: "EMBER_WASTES", region: "NORTH", polygon: ["C", "D", "R", "Q"], description: "Volcanic plains and forges." },
  { id: "FROSTPEAK", region: "EAST", polygon: ["D", "E", "R"], description: "Snowy ridges and glacier paths." },
  { id: "SUNKEN_DELTA", region: "SOUTH", polygon: ["J", "S", "T", "H", "I"], description: "Tidal marshes, harbors and markets." },
  { id: "NOVA_PRIME", region: "CENTRAL", polygon: ["P", "Q", "R", "U", "T", "S"], description: "The capital, rail hub and civic center." },
  { id: "OBSIDIAN_COAST", region: "SOUTH", polygon: ["T", "U", "G", "H"], description: "Black-sand beaches and basalt cliffs." },
  { id: "SKYPORT_ISLES", region: "EAST", polygon: ["R", "E", "F", "G", "U"], description: "Sky-docks and the main spaceport." },
];

const zoneById = new Map(CITY_ZONES.map((zone) => [zone.id, zone]));

export function cityRegionForZone(zoneId: CityZoneId): CityRegionId {
  return zoneById.get(zoneId)?.region ?? "CENTRAL";
}

export function zonesForAlertScope(scope: CityAlertScopeId): readonly CityZoneId[] {
  if (scope === "ALL") return CITY_ZONE_IDS;
  if ((CITY_REGION_IDS as readonly string[]).includes(scope)) {
    return CITY_ZONES.filter((zone) => zone.region === scope).map((zone) => zone.id);
  }
  return [scope as CityZoneId];
}

export function alertTargetsZone(scope: CityAlertScopeId, zoneId: CityZoneId | null): boolean {
  if (scope === "ALL") return true;
  if (!zoneId) return false;
  return zonesForAlertScope(scope).includes(zoneId);
}

export function cityZoneLabelKey(zoneId: CityZoneId): `alerts.zone.${CityZoneId}` {
  return `alerts.zone.${zoneId}`;
}

export function cityRegionLabelKey(regionId: CityRegionId): `alerts.region.${CityRegionId}` {
  return `alerts.region.${regionId}`;
}

export function cityAlertScopeLabelKey(scope: CityAlertScopeId): `alerts.scope.${CityAlertScopeId}` {
  return `alerts.scope.${scope}`;
}

/** How a zone is doing, from the most serious active alert that reaches it. */
export const ZONE_STATUSES = ["SAFE", "WATCH", "WARNING", "DANGER"] as const;
export type ZoneStatusId = (typeof ZONE_STATUSES)[number];

const SEVERITY_WEIGHT: Readonly<Record<CityAlertSeverityId, number>> = { INFORMATION: 10, WARNING: 30, CRITICAL: 55 };
const SEVERITY_STATUS: Readonly<Record<CityAlertSeverityId, ZoneStatusId>> = { INFORMATION: "WATCH", WARNING: "WARNING", CRITICAL: "DANGER" };

/** Health from 0 to 100: each active alert reaching the zone takes points off, the worst one sets the status. */
export function zoneHealth(severities: readonly CityAlertSeverityId[]): { readonly score: number; readonly status: ZoneStatusId } {
  const score = Math.max(5, 100 - severities.reduce((sum, severity) => sum + SEVERITY_WEIGHT[severity], 0));
  const rank = (status: ZoneStatusId) => ZONE_STATUSES.indexOf(status);
  const status = severities.map((severity) => SEVERITY_STATUS[severity]).reduce<ZoneStatusId>((worst, next) => (rank(next) > rank(worst) ? next : worst), "SAFE");
  return { score, status };
}

/** Centre of a zone on the 1000 × 640 map plane. */
export function zoneCentroid(zone: CityZoneDefinition): readonly [number, number] {
  const points = zone.polygon.map((key) => CITY_ZONE_VERTICES[key]);
  return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
}

/** Which zone contains a point of the map plane, if any (ray casting). */
export function zoneAt(x: number, y: number): CityZoneId | null {
  for (const zone of CITY_ZONES) {
    const points = zone.polygon.map((key) => CITY_ZONE_VERTICES[key]);
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i] ?? [0, 0];
      const [xj, yj] = points[j] ?? [0, 0];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return zone.id;
  }
  return null;
}

export function cityZoneDefinition(zoneId: CityZoneId): CityZoneDefinition | undefined {
  return zoneById.get(zoneId);
}
