"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";

export interface AutoPlace {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** The viewer's "Ma position automatique" setting, fetched once per page load. */
let settingPromise: Promise<boolean> | null = null;
export function loadAutoLocationSetting(): Promise<boolean> {
  settingPromise ??= apiFetch<{ autoLocation?: boolean }>("/api/users/me")
    .then((profile) => profile.autoLocation === true)
    .catch(() => false);
  return settingPromise;
}
/** After the user flips the switch in settings. */
export function resetAutoLocationSetting(): void {
  settingPromise = null;
}

async function permissionState(): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unsupported";
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return "prompt";
  }
}

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 }),
  );
}

/**
 * Automatic town for new posts. Runs at once when the browser already allows
 * location; otherwise waits for `request()` (called on the first focus of the
 * composer) so a page load never pops a permission prompt. Only the town is
 * resolved, from a point snapped to ~1 km by the server.
 */
export function useAutoLocation() {
  const [enabled, setEnabled] = useState(false);
  const [place, setPlace] = useState<AutoPlace | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const started = useRef(false);

  const resolve = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    try {
      const position = await currentPosition();
      const response = await apiFetch<{ data: AutoPlace }>(
        `/api/places/reverse?lat=${position.coords.latitude}&lng=${position.coords.longitude}&precision=town`,
      );
      setPlace(response.data);
    } catch {
      // Refused or unavailable: simply no automatic place.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const on = await loadAutoLocationSetting();
      if (cancelled || !on) return;
      setEnabled(true);
      if ((await permissionState()) === "granted") void resolve();
    })();
    return () => {
      cancelled = true;
    };
  }, [resolve]);

  const request = useCallback(() => {
    if (enabled) void resolve();
  }, [enabled, resolve]);

  const reset = useCallback(() => setDismissed(false), []);

  return { enabled, place: dismissed ? null : place, request, dismiss: () => setDismissed(true), reset };
}

/** Where the map should open for this viewer, when the setting and browser allow it. */
export async function autoMapCenter(): Promise<{ latitude: number; longitude: number } | null> {
  if (!(await loadAutoLocationSetting())) return null;
  if ((await permissionState()) !== "granted") return null;
  try {
    const position = await currentPosition();
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}
