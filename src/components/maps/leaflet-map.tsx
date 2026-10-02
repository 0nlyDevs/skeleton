"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

export interface MapMarker {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly content?: React.ReactNode;
}

export interface MapBounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** CSS-only pin: no marker images to fetch (CSP-friendly, lighter page). */
const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#5b5bd6;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -22],
});

function Events({ onBounds, onPick }: { readonly onBounds?: (bounds: MapBounds) => void; readonly onPick?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onBounds?.({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
    },
    click: (event) => onPick?.(event.latlng.lat, event.latlng.lng),
  });
  useEffect(() => {
    const bounds = map.getBounds();
    onBounds?.({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
    // Report the initial area once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Recenter({ latitude, longitude, zoom }: { readonly latitude: number; readonly longitude: number; readonly zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], zoom);
  }, [map, latitude, longitude, zoom]);
  return null;
}

/**
 * The one map component (OpenStreetMap tiles, no key). Always rendered via
 * `next/dynamic` with `ssr: false` because Leaflet needs `window`.
 */
export default function LeafletMap({
  latitude,
  longitude,
  zoom = 13,
  markers = [],
  onBounds,
  onPick,
  className,
}: {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom?: number;
  readonly markers?: readonly MapMarker[];
  readonly onBounds?: (bounds: MapBounds) => void;
  readonly onPick?: (lat: number, lng: number) => void;
  readonly className?: string;
}) {
  return (
    <MapContainer center={[latitude, longitude]} zoom={zoom} scrollWheelZoom className={className} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <Recenter latitude={latitude} longitude={longitude} zoom={zoom} />
      <Events {...(onBounds ? { onBounds } : {})} {...(onPick ? { onPick } : {})} />
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={pin}>
          {marker.content ? <Popup>{marker.content}</Popup> : null}
        </Marker>
      ))}
    </MapContainer>
  );
}
