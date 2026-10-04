"use client";

import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";

import { Map } from "./map";

export interface PickedPlace {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** Choose a place by search, by tapping the map, or from the device position. */
export function LocationPicker({
  open,
  onOpenChange,
  onPick,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPick: (place: PickedPlace) => void;
}) {
  const t = useTranslation();
  const [q, setQ] = useState("");
  const term = useDebouncedValue(q.trim(), 400);
  const [results, setResults] = useState<PickedPlace[]>([]);
  const [selected, setSelected] = useState<PickedPlace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    apiFetch<{ data: PickedPlace[] }>(`/api/places/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then((response) => setResults(response.data))
      .catch((caught: unknown) => {
        if ((caught as { name?: string }).name !== "AbortError") setError(describeApiError(caught, t));
      })
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [term, t]);

  const reverse = async (latitude: number, longitude: number) => {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<{ data: PickedPlace }>(`/api/places/reverse?lat=${latitude}&lng=${longitude}`);
      setSelected(response.data);
    } catch (caught) {
      setError(describeApiError(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setError(t("place.denied"));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => void reverse(position.coords.latitude, position.coords.longitude),
      () => {
        setBusy(false);
        setError(t("place.denied"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("place.title")}</DialogTitle>
          <DialogDescription>{t("place.privacy")}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("place.search")} className="pl-9" autoFocus />
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" onClick={locate} disabled={busy} aria-label={t("place.my_position")}>
                <Crosshair />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("place.my_position")}</TooltipContent>
          </Tooltip>
        </div>
        {error ? <p role="alert" className="text-[0.7812rem] text-error">{error}</p> : null}
        {results.length > 0 ? (
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-border/70">
            {results.map((place) => (
              <li key={`${place.latitude},${place.longitude}`}>
                <button
                  type="button"
                  onClick={() => setSelected(place)}
                  className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-[0.8438rem] hover:bg-surface-muted", selected?.name === place.name && "bg-accent")}
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{place.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="h-56 overflow-hidden rounded-xl">
          <Map
            latitude={selected?.latitude ?? -18.8792}
            longitude={selected?.longitude ?? 47.5079}
            zoom={selected ? 15 : 5}
            markers={selected ? [{ id: "picked", latitude: selected.latitude, longitude: selected.longitude }] : []}
            onPick={(lat, lng) => void reverse(lat, lng)}
          />
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="truncate text-[0.8125rem] text-muted-foreground">
            {busy ? <Loader2 className="inline size-4 animate-spin" /> : selected?.name}
          </span>
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) onPick(selected);
              onOpenChange(false);
            }}
          >
            {t("place.choose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
