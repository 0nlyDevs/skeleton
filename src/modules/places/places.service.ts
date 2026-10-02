/**
 * Places: geocoding (text → coordinates) and reverse geocoding, through
 * OpenStreetMap's Nominatim — no API key, works on any deployment.
 *
 * Security: the upstream host is fixed in code (no user-controlled URL, so no
 * SSRF), queries are length-bounded, responses are reduced to three fields,
 * results are cached for a day, and calls are serialised to Nominatim's
 * one-request-per-second policy so the app is never banned mid-demo.
 */

import { cacheKey, getOrSet } from "@/lib/cache";
import { env } from "@/lib/env";
import { ServiceUnavailableError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const ENDPOINT = "https://nominatim.openstreetmap.org";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlaceDto {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** ~100 m: precise enough for a café, too coarse for a front door. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

let queue: Promise<unknown> = Promise.resolve();
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => new Promise((resolve) => setTimeout(resolve, 1_100)),
    () => new Promise((resolve) => setTimeout(resolve, 1_100)),
  );
  return run;
}

async function call(path: string, params: Record<string, string>, language: string): Promise<unknown> {
  const url = new URL(path, ENDPOINT);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", language);
  return throttled(async () => {
    const response = await fetch(url, {
      headers: { "User-Agent": `Skeleton/1.0 (${env.appUrl})` },
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`nominatim responded ${response.status}`);
    return response.json() as Promise<unknown>;
  });
}

interface NominatimPlace {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

function toPlace(item: NominatimPlace): PlaceDto | null {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const full = item.display_name ?? item.name ?? "";
  // "Café X, Rue Y, Quartier, Ville, Région, Pays" → the first three parts.
  const name = full.split(",").slice(0, 3).map((part) => part.trim()).filter(Boolean).join(", ").slice(0, 160);
  return { name: name || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, latitude, longitude };
}

export async function searchPlaces(q: string, language: string): Promise<PlaceDto[]> {
  const query = q.trim().slice(0, 120);
  if (query.length < 2) return [];
  try {
    return await getOrSet(cacheKey("places:search", language, query.toLowerCase()), DAY_MS, async () => {
      const data = (await call("/search", { q: query, limit: "6", addressdetails: "0" }, language)) as NominatimPlace[];
      return (Array.isArray(data) ? data : []).map(toPlace).filter((place): place is PlaceDto => place !== null);
    });
  } catch (error) {
    logger.warn("place search failed", { error });
    throw new ServiceUnavailableError("Place search is unavailable right now.");
  }
}

/**
 * `town` precision (automatic location) never reveals more than the town: the
 * point is snapped to ~1 km before geocoding and only the town name is kept.
 */
export async function reversePlace(latitude: number, longitude: number, language: string, precision: "exact" | "town" = "exact"): Promise<PlaceDto> {
  const lat = precision === "town" ? Math.round(latitude * 100) / 100 : roundCoordinate(latitude);
  const lng = precision === "town" ? Math.round(longitude * 100) / 100 : roundCoordinate(longitude);
  try {
    return await getOrSet(cacheKey("places:reverse", precision, language, lat, lng), DAY_MS, async () => {
      const data = (await call("/reverse", { lat: String(lat), lon: String(lng), zoom: precision === "town" ? "10" : "16" }, language)) as NominatimPlace;
      const place = toPlace(data);
      if (!place) return { name: `${lat}, ${lng}`, latitude: lat, longitude: lng };
      return precision === "town"
        ? { name: place.name.split(",")[0]?.trim() || place.name, latitude: lat, longitude: lng }
        : { ...place, latitude: roundCoordinate(place.latitude), longitude: roundCoordinate(place.longitude) };
    });
  } catch (error) {
    logger.warn("reverse geocoding failed", { error });
    return { name: `${lat}, ${lng}`, latitude: lat, longitude: lng };
  }
}
