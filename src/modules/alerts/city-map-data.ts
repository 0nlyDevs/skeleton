import type { CityZoneId } from "./city-zones";

/**
 * Landmarks of Terra Nova, from the city map (positions on the 1000 × 640
 * plane). They give the map something to look at and the safety assistant
 * concrete places to refer to; they are reference data, not user content.
 */
export const PLACE_KINDS = ["SIGHT", "TRANSIT", "STAY", "FOOD", "MARKET", "NATURE"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export interface CityPlace {
  readonly name: string;
  readonly zone: CityZoneId;
  readonly kind: PlaceKind;
  readonly x: number;
  readonly y: number;
}

export const CITY_PLACES: readonly CityPlace[] = [
  { name: "Prism Observatory", zone: "CRYSTAL_REACH", kind: "SIGHT", x: 200, y: 200 },
  { name: "Lumen Café", zone: "CRYSTAL_REACH", kind: "FOOD", x: 260, y: 260 },
  { name: "Shard Lodge", zone: "CRYSTAL_REACH", kind: "STAY", x: 160, y: 270 },
  { name: "Greenroot Market", zone: "VERDANT_BASIN", kind: "MARKET", x: 420, y: 170 },
  { name: "Canopy Inn", zone: "VERDANT_BASIN", kind: "STAY", x: 500, y: 200 },
  { name: "Fernwell Gardens", zone: "VERDANT_BASIN", kind: "NATURE", x: 380, y: 130 },
  { name: "Cinder Diner", zone: "EMBER_WASTES", kind: "FOOD", x: 640, y: 190 },
  { name: "Magma Forge Museum", zone: "EMBER_WASTES", kind: "SIGHT", x: 720, y: 190 },
  { name: "Ashfall Camp", zone: "EMBER_WASTES", kind: "NATURE", x: 600, y: 160 },
  { name: "Summit Lodge", zone: "FROSTPEAK", kind: "STAY", x: 825, y: 225 },
  { name: "Icefall Café", zone: "FROSTPEAK", kind: "FOOD", x: 840, y: 260 },
  { name: "Glacier Station", zone: "FROSTPEAK", kind: "TRANSIT", x: 800, y: 190 },
  { name: "Coral Harbor", zone: "SUNKEN_DELTA", kind: "TRANSIT", x: 200, y: 420 },
  { name: "Tidewalk Bazaar", zone: "SUNKEN_DELTA", kind: "MARKET", x: 300, y: 400 },
  { name: "Mangrove Hotel", zone: "SUNKEN_DELTA", kind: "STAY", x: 150, y: 380 },
  { name: "Nova Central Station", zone: "NOVA_PRIME", kind: "TRANSIT", x: 520, y: 310 },
  { name: "Senate Spire", zone: "NOVA_PRIME", kind: "SIGHT", x: 430, y: 290 },
  { name: "Grand Meridian Hotel", zone: "NOVA_PRIME", kind: "STAY", x: 620, y: 320 },
  { name: "Starlight Plaza", zone: "NOVA_PRIME", kind: "MARKET", x: 350, y: 300 },
  { name: "Basalt Grill", zone: "OBSIDIAN_COAST", kind: "FOOD", x: 520, y: 440 },
  { name: "Obsidian Spa Resort", zone: "OBSIDIAN_COAST", kind: "STAY", x: 600, y: 480 },
  { name: "Black Sand Beach", zone: "OBSIDIAN_COAST", kind: "NATURE", x: 450, y: 490 },
  { name: "Terra Nova Spaceport", zone: "SKYPORT_ISLES", kind: "TRANSIT", x: 780, y: 380 },
  { name: "Cloud Terrace Café", zone: "SKYPORT_ISLES", kind: "FOOD", x: 830, y: 330 },
  { name: "Zenith Skyhotel", zone: "SKYPORT_ISLES", kind: "STAY", x: 760, y: 460 },
];

/**
 * Relief and ground colours per zone, for the 3D map. Heights are in map
 * units; `rough` scales the noise, `ridge` makes sharp mountain crests.
 */
export interface ZoneTerrain {
  readonly base: number;
  readonly relief: number;
  readonly rough: number;
  readonly ridge: number;
  readonly low: string;
  readonly high: string;
}

export const ZONE_TERRAIN: Readonly<Record<CityZoneId, ZoneTerrain>> = {
  CRYSTAL_REACH: { base: 14, relief: 44, rough: 1.4, ridge: 0.7, low: "#5f6e55", high: "#aeb5b9" },
  VERDANT_BASIN: { base: 6, relief: 10, rough: 0.9, ridge: 0.1, low: "#476f2e", high: "#6f8f45" },
  EMBER_WASTES: { base: 9, relief: 22, rough: 1.2, ridge: 0.45, low: "#7e4e2f", high: "#a97a4f" },
  FROSTPEAK: { base: 24, relief: 72, rough: 1.6, ridge: 0.9, low: "#8d9a8a", high: "#f4f6f8" },
  SUNKEN_DELTA: { base: 1.2, relief: 2.5, rough: 0.6, ridge: 0, low: "#577349", high: "#728d5c" },
  NOVA_PRIME: { base: 5, relief: 3, rough: 0.5, ridge: 0, low: "#807f78", high: "#9c9a92" },
  OBSIDIAN_COAST: { base: 4, relief: 9, rough: 1.1, ridge: 0.3, low: "#47494d", high: "#6e7177" },
  SKYPORT_ISLES: { base: 7, relief: 8, rough: 0.8, ridge: 0.15, low: "#9d8c63", high: "#bfae84" },
};
