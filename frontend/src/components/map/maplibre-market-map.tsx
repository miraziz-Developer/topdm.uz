"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";

import { StoreMarkerPin } from "@/components/map/store-marker-pin";
import { UserLocationMarker } from "@/components/map/user-location-marker";
import { RouteDestinationMarker } from "@/components/map/route-destination-marker";
import { applyMapDisplayOffset, IPPODROM_CENTER, isInsideIppodromGpsAcceptZone, type GeoLatLng } from "@/lib/geo/market-geo";
import {
  resolveMapLibreRasterFallback,
  resolveMapLibreStyleUrl,
  type MapLibreStyleInput,
} from "@/lib/map/maplibre-styles";
import {
  fitMapLibreToSpatialContent,
  flyMapLibreToVisiblePoint,
  MAPLIBRE_FOCUS_ZOOM,
} from "@/lib/map/maplibre-viewport";
import {
  buildRouteLineGeoJson,
  PRESTIGE_ROUTE_SOURCE_ID,
} from "@/lib/map/prestige-route-geojson";
import { RouteStartMarker } from "@/components/map/route-start-marker";
import { buildAnchoredRoutePath, finalizeStreetRoutePath, resolveRouteAnchors } from "@/lib/map/route-geometry";
import type { RouteStartMode } from "@/hooks/useIppodromMapPage";
import type { MapChromeInsets } from "@/lib/map/spatial-viewport";
import { spreadMarkerDisplayCoords } from "@/lib/map/spread-marker-coords";
import type { MapShopMarker } from "@/lib/shop-location";
import type { IndoorRoute } from "@/lib/indoor-map/types";
import { cn } from "@/lib/utils";

const DEFAULT_ZOOM = 17;

const ROUTE_OUTLINE_LAYER = {
  id: `${PRESTIGE_ROUTE_SOURCE_ID}-outline`,
  type: "line" as const,
  paint: {
    "line-color": "#FFFFFF",
    "line-width": 10,
    "line-opacity": 0.95,
  },
  layout: {
    "line-cap": "round" as const,
    "line-join": "round" as const,
  },
};

const ROUTE_CORE_LAYER = {
  id: `${PRESTIGE_ROUTE_SOURCE_ID}-core`,
  type: "line" as const,
  paint: {
    "line-color": "#1E98FF",
    "line-width": 7,
    "line-opacity": 1,
  },
  layout: {
    "line-cap": "round" as const,
    "line-join": "round" as const,
  },
};

function MapLibreViewportController({
  mapRef,
  markers,
  selectedShopId,
  routePath,
  focusTarget,
  focusToken,
  chrome,
}: {
  mapRef: RefObject<MapRef | null>;
  markers: MapShopMarker[];
  selectedShopId: string | null;
  routePath: GeoLatLng[];
  focusTarget: GeoLatLng | null;
  focusToken: string;
  chrome: MapChromeInsets;
}) {
  const didInitialFit = useRef(false);
  const lastRouteKey = useRef("");
  const lastFocusKey = useRef("");

  const focusLat = focusTarget?.lat ?? null;
  const focusLng = focusTarget?.lng ?? null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const head = routePath[0];
    const tail = routePath[routePath.length - 1];
    const routeKey = `${routePath.length}:${head?.lat},${head?.lng}:${tail?.lat},${tail?.lng}`;
    const routeChanged = routeKey !== lastRouteKey.current;
    lastRouteKey.current = routeKey;

    if (routePath.length > 1 && routeChanged) {
      fitMapLibreToSpatialContent(map, {
        routePath,
        chrome,
        maxZoom: MAPLIBRE_FOCUS_ZOOM,
        duration: 900,
      });
      didInitialFit.current = true;
      return;
    }

    const focusKey = `${focusToken}:${selectedShopId ?? ""}:${focusLat}:${focusLng}`;
    if (
      focusLat != null &&
      focusLng != null &&
      (focusTarget || selectedShopId) &&
      focusKey !== lastFocusKey.current
    ) {
      lastFocusKey.current = focusKey;
      const timer = window.setTimeout(() => {
        flyMapLibreToVisiblePoint(
          map,
          { lat: focusLat, lng: focusLng },
          MAPLIBRE_FOCUS_ZOOM,
          chrome,
          900,
        );
      }, 120);
      didInitialFit.current = true;
      return () => window.clearTimeout(timer);
    }

    if (didInitialFit.current || markers.length === 0) return;
    fitMapLibreToSpatialContent(map, { markers, chrome, duration: 900 });
    didInitialFit.current = true;
  }, [
    mapRef,
    routePath,
    focusLat,
    focusLng,
    focusTarget,
    focusToken,
    selectedShopId,
    markers.length,
    chrome.top,
    chrome.right,
    chrome.bottom,
    chrome.left,
  ]);

  return null;
}

export type MapLibreMarketMapProps = {
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
  onMapReady?: (map: MapRef) => void;
  onSelectShop: (marker: MapShopMarker) => void;
  onPickStartPoint?: (lat: number, lng: number) => void;
  /** Crosshair cursor when user can pick start on map (Kirish mode). */
  pickStartOnMap?: boolean;
  routeBusy?: boolean;
  showDestinationMarker?: boolean;
  routeStartMode?: RouteStartMode;
  onMapUserInteract?: () => void;
};

export function MapLibreMarketMap({
  mapTilerKey,
  markers,
  selectedShopId,
  fromNodeId,
  route,
  streetRoutePath = null,
  routeStartPoint = null,
  userLat = null,
  userLng = null,
  userAccuracyM = null,
  focusTarget,
  focusToken,
  chrome,
  onMapReady,
  onSelectShop,
  onPickStartPoint,
  pickStartOnMap = false,
  routeBusy = false,
  showDestinationMarker = false,
  routeStartMode = "entrance",
  onMapUserInteract,
}: MapLibreMarketMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapStyle, setMapStyle] = useState<MapLibreStyleInput>(() =>
    resolveMapLibreStyleUrl(mapTilerKey),
  );
  const styleEpoch = useRef(0);

  const selectedMarker = markers.find((m) => m.id === selectedShopId) ?? null;

  const indoorRoutePath = useMemo(() => {
    if (!route?.points?.length) return [];
    const anchors = resolveRouteAnchors(markers, selectedMarker, fromNodeId);
    const start = route.originGps ?? anchors.start;
    return buildAnchoredRoutePath(route.points, { start, goal: anchors.goal });
  }, [route?.points, route?.originGps, markers, selectedMarker, fromNodeId]);

  const routeAnchors = useMemo(() => {
    const anchors = resolveRouteAnchors(markers, selectedMarker, fromNodeId);
    const start = routeStartPoint ?? route?.originGps ?? anchors.start;
    return { start, goal: anchors.goal };
  }, [markers, selectedMarker, fromNodeId, routeStartPoint, route?.originGps]);

  const streetPath = useMemo(() => {
    if (!streetRoutePath || streetRoutePath.length < 2) return [];
    return finalizeStreetRoutePath(streetRoutePath, routeAnchors.start, routeAnchors.goal);
  }, [streetRoutePath, routeAnchors]);

  const routePath = useMemo(() => {
    if (streetPath.length >= 2) return streetPath;
    if (indoorRoutePath.length >= 2) return indoorRoutePath;
    return [];
  }, [streetPath, indoorRoutePath]);

  const showUserLocation =
    userLat != null &&
    userLng != null &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLng) &&
    isInsideIppodromGpsAcceptZone(userLat, userLng);
  const userDisplay = showUserLocation ? applyMapDisplayOffset({ lat: userLat!, lng: userLng! }) : null;

  const routeGeoJson = useMemo(() => buildRouteLineGeoJson(routePath), [routePath]);
  const destinationPoint = routeAnchors.goal;
  const routeLineStart = routePath.length >= 2 ? routePath[0]! : routeStartPoint;
  const routeLineEnd =
    routePath.length >= 2 ? routePath[routePath.length - 1]! : destinationPoint;

  const switchToRasterFallback = useCallback(() => {
    setMapStyle((current) => {
      if (typeof current !== "string") return current;
      styleEpoch.current += 1;
      return resolveMapLibreRasterFallback();
    });
  }, []);

  const handleError = useCallback(() => {
    switchToRasterFallback();
  }, [switchToRasterFallback]);

  const handleLoad = () => {
    const ref = mapRef.current;
    if (!ref) return;
    onMapReady?.(ref);
    window.setTimeout(() => ref.getMap()?.resize(), 80);
  };

  useEffect(() => {
    setMapStyle(resolveMapLibreStyleUrl(mapTilerKey));
  }, [mapTilerKey]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const timer = window.setTimeout(() => map.resize(), 120);
    return () => window.clearTimeout(timer);
  }, [chrome.top, chrome.right, chrome.bottom, chrome.left]);


  const mapKey = useMemo(
    () => `map-style-${styleEpoch.current}-${typeof mapStyle === "string" ? mapStyle : "carto-raster"}`,
    [mapStyle],
  );

  return (
    <div
      className={cn(
        "maplibre-market-map relative h-full w-full min-h-0",
        pickStartOnMap && onPickStartPoint ? "cursor-crosshair" : "",
      )}
    >
      <Map
        key={mapKey}
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{
          longitude: IPPODROM_CENTER.lng,
          latitude: IPPODROM_CENTER.lat,
          zoom: DEFAULT_ZOOM,
        }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        onLoad={handleLoad}
        onError={handleError}
        onDragStart={() => onMapUserInteract?.()}
        onClick={(event) => {
          if (!onPickStartPoint) return;
          event.originalEvent?.preventDefault?.();
          onPickStartPoint(event.lngLat.lat, event.lngLat.lng);
        }}
        doubleClickZoom={!pickStartOnMap}
        reuseMaps={false}
      >
        <MapLibreViewportController
          mapRef={mapRef}
          markers={markers}
          selectedShopId={selectedShopId}
          routePath={routePath}
          focusTarget={focusTarget}
          focusToken={focusToken}
          chrome={chrome}
        />

        {routeGeoJson.features.length > 0 ? (
          <Source id={PRESTIGE_ROUTE_SOURCE_ID} type="geojson" data={routeGeoJson}>
            <Layer {...ROUTE_OUTLINE_LAYER} />
            <Layer {...ROUTE_CORE_LAYER} />
          </Source>
        ) : null}

        {showUserLocation ? (
          <Marker longitude={userDisplay!.lng} latitude={userDisplay!.lat} anchor="center">
            <UserLocationMarker accuracyM={userAccuracyM} />
          </Marker>
        ) : null}

        {routeLineStart && routePath.length > 1 ? (
          <Marker longitude={routeLineStart.lng} latitude={routeLineStart.lat} anchor="center">
            <RouteStartMarker />
          </Marker>
        ) : null}

        {showDestinationMarker && destinationPoint && routePath.length > 1 ? (
          <Marker longitude={destinationPoint.lng} latitude={destinationPoint.lat} anchor="center">
            <RouteDestinationMarker />
          </Marker>
        ) : null}

        {(() => {
          const displayCoords = spreadMarkerDisplayCoords(markers);
          return markers.map((marker) => {
          const focused = marker.id === selectedShopId;
          const pos = displayCoords.get(marker.id) ?? { lat: marker.lat, lng: marker.lng };
          return (
            <Marker
              key={`${marker.id}-${focused ? "focused" : "idle"}`}
              longitude={pos.lng}
              latitude={pos.lat}
              anchor="bottom"
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                onSelectShop(marker);
              }}
            >
              <StoreMarkerPin
                name={marker.name}
                block={marker.pin.block}
                stall={marker.shopNumber || marker.pin.stall}
                floor={marker.pin.floor}
                row={marker.rowLabel}
                comment={marker.locationComment}
                logoUrl={marker.logo_url}
                active={focused}
              />
            </Marker>
          );
        });
        })()}
      </Map>

      {routeBusy ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
          <div className="rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-semibold text-electric-700 shadow-lg backdrop-blur-md">
            Marshrut yangilanmoqda…
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-md bg-white/75 px-2 py-1 text-[9px] font-medium text-ink-500 shadow-sm backdrop-blur-sm">
        © OpenStreetMap
      </div>
    </div>
  );
}
