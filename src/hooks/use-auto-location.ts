"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { apiFetch } from "@/lib/api/client";
import { cityZoneDefinition, cityZoneLabelKey, zoneCentroid, type CityZoneId } from "@/modules/alerts/city-zones";

/** A place on the Terra Nova map, in the shape the map picker and composer use. */
export interface AutoPlace {
  readonly name: string;
  readonly mapX: number;
  readonly mapY: number;
}

interface AutoLocationProfile {
  readonly autoLocation?: boolean;
  readonly cityZone?: CityZoneId | null;
}

/** The viewer's "Ma position automatique" setting, fetched once per page load. */
let settingPromise: Promise<AutoLocationProfile> | null = null;
export function loadAutoLocationSetting(): Promise<AutoLocationProfile> {
  settingPromise ??= apiFetch<AutoLocationProfile>("/api/users/me").catch(() => ({ autoLocation: false, cityZone: null }));
  return settingPromise;
}
/** After the user flips the switch in settings. */
export function resetAutoLocationSetting(): void {
  settingPromise = null;
}

/**
 * "Ma position automatique": when the resident turned the setting on and saved
 * a district, a new post is placed at the centre of that district. Terra Nova
 * is a fictional city, so this never asks the browser for a real position and
 * never calls an external service.
 */
export function useAutoLocation() {
  const t = useTranslation();
  const [place, setPlace] = useState<AutoPlace | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const started = useRef(false);

  const resolve = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    const profile = await loadAutoLocationSetting();
    if (!profile.autoLocation || !profile.cityZone) return;
    const zone = cityZoneDefinition(profile.cityZone);
    if (!zone) return;
    const [x, y] = zoneCentroid(zone);
    setPlace({ name: t(cityZoneLabelKey(profile.cityZone)), mapX: Math.round(x), mapY: Math.round(y) });
  }, [t]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  const request = useCallback(() => {
    void resolve();
  }, [resolve]);

  const reset = useCallback(() => setDismissed(false), []);

  return { place: dismissed ? null : place, request, dismiss: () => setDismissed(true), reset };
}
