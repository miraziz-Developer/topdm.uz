"use client";

import { Layers, LocateFixed, Minus, Plus, TrafficCone } from "lucide-react";

import {
  YANDEX_MAP_LAYERS,
  type YandexMapLayerId,
} from "@/lib/map/yandex-map-types";
import type { YandexMapHandle } from "@/lib/map/yandex-map-handle";
import { cn } from "@/lib/utils";

type YandexFloatingControlsProps = {
  mapHandle: YandexMapHandle | null;
  mapLayer: YandexMapLayerId;
  onMapLayerChange: (layer: YandexMapLayerId) => void;
  trafficOn: boolean;
  onTrafficToggle: () => void;
  onMyLocation: () => void;
  onRecenterMarket: () => void;
  className?: string;
};

export function YandexFloatingControls({
  mapHandle,
  mapLayer,
  onMapLayerChange,
  trafficOn,
  onTrafficToggle,
  onMyLocation,
  onRecenterMarket,
  className,
}: YandexFloatingControlsProps) {
  return (
    <div className={cn("pointer-events-auto flex flex-col items-end gap-2.5", className)}>
      <div className="rounded-2xl border border-white/70 bg-white/92 p-1.5 shadow-xl backdrop-blur-md">
        <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-wide text-ink-500">
          Xarita turi
        </p>
        <div className="flex flex-col gap-1">
          {YANDEX_MAP_LAYERS.map((layer) => {
            const active = mapLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                title={layer.description}
                onClick={() => onMapLayerChange(layer.id)}
                className={cn(
                  "rounded-xl px-3 py-2 text-left text-[11px] font-bold transition",
                  active
                    ? "bg-[#1E98FF] text-white shadow-md"
                    : "text-ink-700 hover:bg-[#1E98FF]/10 hover:text-[#1E98FF]",
                )}
              >
                {layer.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/92 shadow-xl backdrop-blur-md">
        <button
          type="button"
          aria-label="Yaqinlashtirish"
          onClick={() => mapHandle?.zoomIn()}
          className="flex h-11 w-11 items-center justify-center text-ink-700 transition hover:bg-[#1E98FF]/10 hover:text-[#1E98FF]"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Uzoqlashtirish"
          onClick={() => mapHandle?.zoomOut()}
          className="flex h-11 w-11 items-center justify-center border-t border-neutral-200/80 text-ink-700 transition hover:bg-[#1E98FF]/10 hover:text-[#1E98FF]"
        >
          <Minus className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onTrafficToggle}
        title="Tirbandlik qatlami"
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md transition",
          trafficOn
            ? "border-amber-300/80 bg-amber-50 text-amber-700"
            : "border-white/70 bg-white/92 text-ink-700 hover:text-[#1E98FF]",
        )}
      >
        <TrafficCone className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onMyLocation}
        className="flex items-center gap-2 rounded-2xl bg-[#1E98FF] px-4 py-3 text-xs font-bold text-white shadow-lg transition hover:bg-[#1787e8]"
      >
        <LocateFixed className="h-4 w-4" />
        Joylashuv
      </button>

      <button
        type="button"
        onClick={onRecenterMarket}
        aria-label="Bozorga markaz"
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/92 text-ink-700 shadow-lg backdrop-blur-md transition hover:text-[#1E98FF]"
      >
        <Layers className="h-5 w-5" />
      </button>
    </div>
  );
}
