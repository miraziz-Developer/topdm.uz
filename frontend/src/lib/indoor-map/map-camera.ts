import L, { type Map } from "leaflet";

import {
  IPPODROM_BOUNDS,
  IPPODROM_MAP_HEIGHT,
  IPPODROM_MAP_WIDTH,
  toLatLng,
} from "@/lib/indoor-map/leaflet-config";
import type { MapPoint } from "@/lib/shop-location";

export const FLOOR_PLAN_BG = "#F4F5F7";

const DEFAULT_PLAN_PADDING: [number, number] = [28, 28];

/** Fit entire Ippodrom floor plan to the visible map pane (fixes minified grey viewport). */
export function fitFloorPlanToView(map: Map, padding: [number, number] = DEFAULT_PLAN_PADDING) {
  map.invalidateSize({ animate: false });
  map.fitBounds(IPPODROM_BOUNDS, {
    padding,
    animate: false,
    maxZoom: 1.25,
  });
}

/**
 * Focus camera so the target occupies ~`fillRatio` of the viewport center.
 * Uses fitBounds on a tight box around the indoor point (CRS.Simple y,x).
 */
export function focusMapOnPoint(
  map: Map,
  point: MapPoint,
  options?: { fillRatio?: number; duration?: number; padding?: [number, number] },
) {
  const fillRatio = Math.min(0.65, Math.max(0.3, options?.fillRatio ?? 0.45));
  const halfW = (IPPODROM_MAP_WIDTH * fillRatio) / 2;
  const halfH = (IPPODROM_MAP_HEIGHT * fillRatio) / 2;

  const southWest = L.latLng(
    Math.max(0, point.y - halfH),
    Math.max(0, point.x - halfW),
  );
  const northEast = L.latLng(
    Math.min(IPPODROM_MAP_HEIGHT, point.y + halfH),
    Math.min(IPPODROM_MAP_WIDTH, point.x + halfW),
  );
  const bounds = L.latLngBounds(southWest, northEast);

  map.invalidateSize({ animate: false });
  map.fitBounds(bounds, {
    padding: options?.padding ?? [48, 48],
    animate: true,
    duration: options?.duration ?? 1.5,
    maxZoom: 2.75,
  });
}

export function flyMapToPoint(map: Map, point: MapPoint, zoom?: number) {
  const z = zoom ?? Math.max(map.getZoom(), 1.15);
  map.flyTo(toLatLng(point), z, { duration: 1.35, easeLinearity: 0.25 });
}
