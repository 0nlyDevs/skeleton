"use client";

import { Crosshair, MapPin } from "lucide-react";
import Link from "@/components/ui/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { autoMapCenter } from "@/hooks/use-auto-location";
import { useFormatters } from "@/hooks/use-formatters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, toQueryString } from "@/lib/api/client";
import type { MapPostDto } from "@/modules/posts/posts.service";

import { Map, type MapBounds } from "./map";

/** Geotagged posts in the visible area; refetched (debounced) when the map moves. */
export function MapExplorer({
  initial,
  initialFromLink = false,
}: {
  readonly initial: { latitude: number; longitude: number; zoom: number };
  /** Opened on a shared point: never move away from it automatically. */
  readonly initialFromLink?: boolean;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [center, setCenter] = useState(initial);
  const [posts, setPosts] = useState<MapPostDto[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback((bounds: MapBounds) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      controller.current?.abort();
      controller.current = new AbortController();
      const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
      void apiFetch<{ data: MapPostDto[] }>(
        `/api/map/posts${toQueryString({
          south: clamp(bounds.south, -90, 90).toFixed(4),
          north: clamp(bounds.north, -90, 90).toFixed(4),
          west: clamp(bounds.west, -180, 180).toFixed(4),
          east: clamp(bounds.east, -180, 180).toFixed(4),
        })}`,
        { signal: controller.current.signal },
      )
        .then((response) => setPosts(response.data))
        .catch(() => undefined);
    }, 350);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();
  }, []);

  // "Ma position automatique": open on the viewer when the browser already allows it.
  useEffect(() => {
    if (initialFromLink) return;
    let cancelled = false;
    void autoMapCenter().then((point) => {
      if (point && !cancelled) setCenter({ ...point, zoom: 12 });
    });
    return () => {
      cancelled = true;
    };
  }, [initialFromLink]);

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (position) => setCenter({ latitude: position.coords.latitude, longitude: position.coords.longitude, zoom: 13 }),
      () => undefined,
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="text-[1.375rem] font-bold tracking-tight">{t("map.title")}</h1>
          <p className="text-[0.8438rem] text-muted-foreground">{t("map.subtitle")}</p>
        </div>
        <Button variant="secondary" onClick={locate}>
          <Crosshair />
          {t("map.locate")}
        </Button>
      </Card>
      <Card className="h-[calc(100dvh-16rem)] min-h-[420px] overflow-hidden p-0">
        <Map
          latitude={center.latitude}
          longitude={center.longitude}
          zoom={center.zoom}
          onBounds={load}
          markers={posts.map((post) => ({
            id: post.id,
            latitude: post.latitude,
            longitude: post.longitude,
            content: (
              <div className="flex w-56 flex-col gap-1.5">
                {post.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authorised, re-encoded image
                  <img src={post.image} alt="" className="h-28 w-full rounded-md object-cover" />
                ) : null}
                <span className="text-[0.75rem] font-semibold">{post.author.name}</span>
                <span className="flex items-center gap-1 text-[0.6875rem] text-neutral-500">
                  <MapPin className="size-3" /> {post.placeName} · {fmt.relative(post.createdAt)}
                </span>
                {post.excerpt ? <span className="line-clamp-3 text-[0.7812rem]">{post.excerpt}</span> : null}
                <Link href={`/feed/${post.id}`} className="text-[0.7812rem] font-semibold text-indigo-600 hover:underline">
                  {t("map.open")}
                </Link>
              </div>
            ),
          }))}
        />
      </Card>
      {posts.length === 0 ? <p className="text-center text-[0.8125rem] text-muted-foreground">{t("map.empty")}</p> : null}
    </div>
  );
}
