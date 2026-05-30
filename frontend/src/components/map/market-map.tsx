"use client";

import { useCallback, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

import { MapLibreMarketMap } from "@/components/map/maplibre-market-map";
import { YandexMarketMap } from "@/components/map/yandex-market-map";
import type { GeoLatLng } from "@/lib/geo/market-geo";
import type { YandexMapHandle } from "@/lib/map/yandex-map-handle";
import {
  isYandexMapsApiEnabled,
  isYandexMapsPreferred,
  resolveYandexMapsApiKey,
  yandexMapsReferrerPatterns,
} from "@/lib/map/yandex-maps-loader";
import type { YandexMapLayerId } from "@/lib/map/yandex-map-types";
import type { YandexTransportMode } from "@/lib/map/yandex-transport-modes";
import type { MapChromeInsets } from "@/lib/map/spatial-viewport";
import type { MapShopMarker } from "@/lib/shop-location";
import type { RouteStartMode } from "@/hooks/useIppodromMapPage";
import type { IndoorRoute } from "@/lib/indoor-map/types";

export type MapEngine = "yandex" | "maplibre";

export type MarketMapProps = {
  mapTilerKey?: string;
  markers: MapShopMarker[];
  selectedShopId: string | null;
  fromNodeId: string;
  route: IndoorRoute | null;
  streetRoutePath?: GeoLatLng[] | null;
  routeStartPoint?: GeoLatLng | null;
  userLat?: number | null;
  userLng?: number | null;
  userAccuracyM?: number | null;
  focusTarget: GeoLatLng | null;
  focusToken: string;
  chrome: MapChromeInsets;
  routeStartMode: RouteStartMode;
  manualMapStart?: { lat: number; lng: number } | null;
  routeRefreshKey?: number;
  yandexAutoBuildRoute?: boolean;
  routeGpsAnchor?: GeoLatLng | null;
  yandexMapLayer?: YandexMapLayerId;
  navigationKey?: number;
  navigationMode?: YandexTransportMode;
  onMapReady?: (map: MapRef | YandexMapHandle | null, engine: MapEngine) => void;
  onSelectShop: (marker: MapShopMarker) => void;
  onPickStartPoint?: (lat: number, lng: number) => void;
  onYandexRouteCalculated?: (info: { distanceM: number | null; error: string | null }) => void;
  onMapUserInteract?: () => void;
  pickStartOnMap?: boolean;
  routeBusy?: boolean;
  showDestinationMarker?: boolean;
};

export function MarketMap({
  mapTilerKey,
  onMapReady,
  routeStartMode,
  routeRefreshKey = 0,
  yandexAutoBuildRoute = true,
  routeGpsAnchor = null,
  yandexMapLayer,
  navigationKey = 0,
  navigationMode = "pedestrian",
  onYandexRouteCalculated,
  onMapUserInteract,
  fromNodeId,
  ...props
}: MarketMapProps) {
  const [yandexScriptFailed, setYandexScriptFailed] = useState(false);

  const handleMapLibreReady = useCallback(
    (map: MapRef) => {
      onMapReady?.(map, "maplibre");
    },
    [onMapReady],
  );

  const handleYandexLoadFailed = useCallback(() => {
    setYandexScriptFailed(true);
  }, []);

  const useYandex =
    isYandexMapsPreferred() && isYandexMapsApiEnabled() && !yandexScriptFailed;

  if (useYandex) {
    return (
      <div className="relative h-full w-full">
        <YandexMarketMap
          apiKey={resolveYandexMapsApiKey()}
          shopsOnly
          routeRefreshKey={routeRefreshKey}
          autoBuildRoute={false}
          routeGpsAnchor={null}
          navigationKey={0}
          navigationMode={navigationMode}
          mapLayer={yandexMapLayer}
          markers={props.markers}
          selectedShopId={props.selectedShopId}
          routeStartMode={routeStartMode}
          fromNodeId={fromNodeId}
          manualMapStart={props.manualMapStart ?? null}
          userLat={props.userLat}
          userLng={props.userLng}
          focusTarget={props.focusTarget}
          focusToken={props.focusToken}
          pickStartOnMap={props.pickStartOnMap}
          onSelectShop={props.onSelectShop}
          onPickStartPoint={props.onPickStartPoint}
          onRouteCalculated={onYandexRouteCalculated}
          onLoadFailed={handleYandexLoadFailed}
          onMapUserInteract={onMapUserInteract}
          onMapReady={(handle) => onMapReady?.(handle, "yandex")}
        />
      </div>
    );
  }

  const showYandexSetupHint = isYandexMapsPreferred() && !isYandexMapsApiEnabled();
  const showYandexReferrerHint = isYandexMapsPreferred() && yandexScriptFailed;

  return (
    <div className="relative h-full w-full">
      {showYandexReferrerHint ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-2">
          <div className="pointer-events-auto max-w-lg rounded-xl border border-amber-400/50 bg-amber-50/95 px-3 py-2.5 text-[11px] leading-snug text-amber-950 shadow-md backdrop-blur-sm">
            <p className="font-bold">Yandex xarita yuklanmadi — zaxira xarita (MapLibre).</p>
            <p className="mt-1">
              Kalitda «HTTP referrer» ga qo‘shing:{" "}
              {yandexMapsReferrerPatterns()
                .slice(0, 3)
                .map((r) => (
                  <code key={r} className="mx-0.5 rounded bg-white/80 px-1">
                    {r}
                  </code>
                ))}
            </p>
            <p className="mt-1 text-[10px] opacity-90">
              <a
                href="https://developer.tech.yandex.ru/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                developer.tech.yandex.ru
              </a>
              {" "}
              → sozlamadan keyin frontendni qayta ishga tushiring.
            </p>
          </div>
        </div>
      ) : null}
      {showYandexSetupHint ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-2">
          <div className="pointer-events-auto max-w-md rounded-xl border border-[#1E98FF]/30 bg-white/95 px-3 py-2 text-center text-[11px] font-medium text-ink-800 shadow-md backdrop-blur-sm">
            To‘liq Yandex Navigator rejimi:{" "}
            <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_YANDEX_MAPS_API_KEY</code> qo‘ying.
            Hozir: Yandex xarita + ko‘cha marshruti (ORS).
          </div>
        </div>
      ) : null}
      <MapLibreMarketMap
        mapTilerKey={mapTilerKey}
        {...props}
        fromNodeId={fromNodeId}
        routeStartMode={routeStartMode}
        onMapUserInteract={onMapUserInteract}
        onMapReady={handleMapLibreReady}
        onSelectShop={props.onSelectShop}
      />
    </div>
  );
}
