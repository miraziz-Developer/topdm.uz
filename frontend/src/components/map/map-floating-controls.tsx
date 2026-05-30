"use client";

import { Layers, LocateFixed, Minus, Plus } from "lucide-react";
import type { MapRef } from "react-map-gl/maplibre";

import { LevelSwitcher } from "@/components/ui/indoor-map/level-switcher";
import type { IndoorLevel } from "@/lib/indoor-map/types";
import { IPPODROM_GEOFENCE } from "@/lib/geo/market-geo";
import { cn } from "@/lib/utils";

type MapFloatingControlsProps = {
  mapRef: MapRef | null;
  levels: IndoorLevel[];
  level: number;
  onLevelChange: (level: number) => void;
  onMyLocation: () => void;
  onRecenterPlan?: () => void;
  className?: string;
};

export function MapFloatingControls({
  mapRef,
  levels,
  level,
  onLevelChange,
  onMyLocation,
  onRecenterPlan,
  className,
}: MapFloatingControlsProps) {
  const inner = mapRef?.getMap();

  const zoomIn = () => {
    if (!inner) return;
    inner.zoomIn({ duration: 300 });
  };

  const zoomOut = () => {
    if (!inner) return;
    inner.zoomOut({ duration: 300 });
  };

  const recenter = () => {
    if (onRecenterPlan) {
      onRecenterPlan();
      return;
    }
    if (!inner) return;
    let minLng = IPPODROM_GEOFENCE[0].lng;
    let maxLng = IPPODROM_GEOFENCE[0].lng;
    let minLat = IPPODROM_GEOFENCE[0].lat;
    let maxLat = IPPODROM_GEOFENCE[0].lat;
    for (const p of IPPODROM_GEOFENCE) {
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
    }
    inner.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 48, duration: 1200, essential: true },
    );
  };

  return (
    <div className={cn("pointer-events-auto flex flex-col items-end gap-3", className)}>
      <LevelSwitcher
        levels={levels}
        value={level}
        onChange={onLevelChange}
        className="glass-panel-strong shadow-elevated"
      />

      <div className="flex flex-col overflow-hidden rounded-2xl glass-panel-strong shadow-elevated ring-1 ring-black/[0.04]">
        <button
          type="button"
          aria-label="Yaqinlashtirish"
          onClick={zoomIn}
          className="flex h-11 w-11 items-center justify-center text-ink-700 transition hover:bg-electric-500/10 hover:text-electric-500"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Uzoqlashtirish"
          onClick={zoomOut}
          className="flex h-11 w-11 items-center justify-center border-t border-border-subtle text-ink-700 transition hover:bg-electric-500/10 hover:text-electric-500"
        >
          <Minus className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onMyLocation}
        className="flex items-center gap-2 rounded-2xl bg-electric-500 px-4 py-3 text-xs font-bold text-white shadow-elevated transition hover:bg-electric-400"
      >
        <LocateFixed className="h-4 w-4" />
        Men shu yerda
      </button>

      <button
        type="button"
        onClick={recenter}
        aria-label="Xaritani markazga"
        className="flex h-11 w-11 items-center justify-center rounded-2xl glass-panel-strong text-ink-700 shadow-elevated transition hover:text-electric-500"
      >
        <Layers className="h-5 w-5" />
      </button>
    </div>
  );
}
