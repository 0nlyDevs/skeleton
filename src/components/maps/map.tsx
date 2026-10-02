"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/** Lazy, client-only map: Leaflet (~40 kB) loads only where a map is shown. */
export const Map = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

export type { MapBounds, MapMarker } from "./leaflet-map";
