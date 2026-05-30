"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  Rectangle,
  useMap,
} from "react-leaflet";
import L, { type Map } from "leaflet";

import { ShopMapPopupContent } from "@/components/map/shop-map-popup";
import type { ShopPopupData } from "@/hooks/useIppodromMapPage";
import { FLOOR_PLAN_BG, fitFloorPlanToView, focusMapOnPoint } from "@/lib/indoor-map/map-camera";
import {
  IPPODROM_BOUNDS,
  IPPODROM_CENTER,
  IPPODROM_CRS,
  IPPODROM_MAP_HEIGHT,
  IPPODROM_MAP_WIDTH,
  boundsFromRect,
  toLatLng,
  toLatLngs,
} from "@/lib/indoor-map/leaflet-config";
import { stallStatusColor } from "@/lib/indoor-map/markets/ippodrom";
import type { IndoorLevel, IndoorMarketPlan, IndoorRoute } from "@/lib/indoor-map/types";
import { pinsMatchStall, type MapPoint, type MapShopMarker } from "@/lib/shop-location";

function gridTileDataUrl(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${IPPODROM_MAP_WIDTH}" height="${IPPODROM_MAP_HEIGHT}" viewBox="0 0 ${IPPODROM_MAP_WIDTH} ${IPPODROM_MAP_HEIGHT}">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,102,255,0.07)" stroke-width="0.65"/>
    </pattern>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FAFBFC"/>
      <stop offset="100%" stop-color="${FLOOR_PLAN_BG}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  <rect x="16" y="228" width="388" height="20" rx="10" fill="#E2E8F0"/>
  <text x="24" y="242" font-size="10" fill="#64748b" font-family="system-ui,sans-serif">Kirish</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function MapReadyNotifier({ onReady }: { onReady: (map: Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function MapViewportController({
  focusPoint,
  focusToken,
  initialFit = true,
}: {
  focusPoint?: MapPoint | null;
  focusToken?: string;
  initialFit?: boolean;
}) {
  const map = useMap();
  const didInitialFit = useRef(false);

  useEffect(() => {
    const runFit = () => {
      map.invalidateSize({ animate: false });
      if (!didInitialFit.current && initialFit) {
        fitFloorPlanToView(map);
        didInitialFit.current = true;
      }
    };

    runFit();
    const t1 = window.setTimeout(runFit, 80);
    const t2 = window.setTimeout(runFit, 320);

    const onResize = () => {
      map.invalidateSize({ animate: false });
      if (focusPoint) {
        focusMapOnPoint(map, focusPoint, { fillRatio: 0.45, duration: 0.6 });
      } else {
        fitFloorPlanToView(map);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [map, initialFit, focusPoint]);

  useEffect(() => {
    if (!focusPoint) return;
    const timer = window.setTimeout(() => {
      focusMapOnPoint(map, focusPoint, { fillRatio: 0.45, duration: 1.5 });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [map, focusPoint?.x, focusPoint?.y, focusToken]);

  return null;
}

function MapBoundsLocker() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(
      L.latLngBounds(L.latLng(0, 0), L.latLng(IPPODROM_MAP_HEIGHT, IPPODROM_MAP_WIDTH)),
    );
    map.setMinZoom(-1.5);
    map.setMaxZoom(3.5);
    map.options.maxBoundsViscosity = 0.85;
  }, [map]);
  return null;
}

function createPinIcon(active: boolean, target: boolean) {
  const variant = target ? "target" : active ? "active" : "default";
  return L.divIcon({
    className: "",
    html: `<div class="ippodrom-marker-pin ippodrom-marker-pin--${variant}"><span></span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

type IppodromLeafletMapProps = {
  plan: IndoorMarketPlan;
  levelPlan: IndoorLevel;
  markers: MapShopMarker[];
  selectedShopId: string | null;
  route: IndoorRoute | null;
  popup: ShopPopupData | null;
  entrancePoint: MapPoint;
  focusPoint?: MapPoint | null;
  focusToken?: string;
  onMapReady: (map: Map) => void;
  onSelectShop: (marker: MapShopMarker) => void;
};

export function IppodromLeafletMap({
  levelPlan,
  markers,
  selectedShopId,
  route,
  popup,
  entrancePoint,
  focusPoint,
  focusToken,
  onMapReady,
  onSelectShop,
}: IppodromLeafletMapProps) {
  const gridUrl = useMemo(() => gridTileDataUrl(), []);
  const levelMarkers = markers.filter((m) => m.pin.floor === levelPlan.level);
  const routePositions = route?.points?.length ? toLatLngs(route.points) : [];

  return (
    <MapContainer
      center={IPPODROM_CENTER}
      zoom={0}
      crs={IPPODROM_CRS}
      className="ippodrom-leaflet-map h-full w-full"
      zoomControl={false}
      attributionControl={false}
      maxBounds={IPPODROM_BOUNDS}
      maxBoundsViscosity={0.85}
      preferCanvas
    >
      <MapReadyNotifier onReady={onMapReady} />
      <MapBoundsLocker />
      <MapViewportController
        focusPoint={focusPoint}
        focusToken={focusToken}
        initialFit={!focusPoint}
      />

      <ImageOverlay url={gridUrl} bounds={IPPODROM_BOUNDS} interactive={false} />

      {levelPlan.blocks.map((block) => (
        <Rectangle
          key={block.id}
          bounds={boundsFromRect(block.x, block.y, block.width, block.height)}
          pathOptions={{
            color: "#0066ff",
            weight: 1.25,
            fillColor: "#ffffff",
            fillOpacity: 0.94,
          }}
        />
      ))}

      {levelPlan.stalls.map((stall) => {
        const marker =
          levelMarkers.find((m) => m.id === stall.shopId) ??
          levelMarkers.find((m) => pinsMatchStall(m.pin, stall));
        const isTarget = Boolean(selectedShopId && (stall.shopId === selectedShopId || marker?.id === selectedShopId));

        return (
          <Rectangle
            key={stall.id}
            bounds={boundsFromRect(stall.x, stall.y, stall.width, stall.height)}
            pathOptions={{
              color: isTarget ? "#0066ff" : stall.status === "occupied" ? "#93c5fd" : "#cbd5e1",
              weight: isTarget ? 2.5 : 1,
              fillColor: isTarget ? "#0066ff" : stallStatusColor(stall.status),
              fillOpacity: isTarget ? 0.92 : 0.85,
            }}
            eventHandlers={{
              click: () => {
                if (marker) onSelectShop(marker);
              },
            }}
          />
        );
      })}

      {routePositions.length > 1 ? (
        <>
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#0066ff",
              weight: 8,
              opacity: 0.22,
              lineCap: "round",
              lineJoin: "round",
              className: "ippodrom-route-glow",
            }}
          />
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#0066ff",
              weight: 5,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              opacity: 0.85,
              dashArray: "10 16",
              lineCap: "round",
              lineJoin: "round",
              className: "ippodrom-route-pulse",
            }}
          />
        </>
      ) : null}

      <CircleMarker
        center={toLatLng(entrancePoint)}
        radius={7}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0066ff", fillOpacity: 1 }}
      />

      {levelMarkers.map((marker) => {
        const isActive = marker.id === selectedShopId;
        return (
          <Marker
            key={marker.id}
            position={toLatLng(marker.point)}
            icon={createPinIcon(isActive, isActive)}
            zIndexOffset={isActive ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectShop(marker),
            }}
          >
            {popup && popup.shop.id === marker.id ? (
              <Popup closeButton className="ippodrom-shop-popup" maxWidth={300} minWidth={240}>
                <ShopMapPopupContent data={popup} />
              </Popup>
            ) : null}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
