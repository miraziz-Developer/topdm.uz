import {
  applyMapDisplayOffset,
  haversineMeters,
  IPPODROM_CENTER,
  isInsideIppodromGeofence,
  isInsideIppodromGpsAcceptZone,
  stripMapDisplayOffset,
  type GeoLatLng,
} from "@/lib/geo/market-geo";
import type { MapShopMarker } from "@/lib/shop-location";

/** Ippodrom ichidagi maksimal piyoda/avto marshrut (metr). */
export const MAX_BOZOR_ROUTE_METERS = 3500;

export function wgs84ToYandexPoint(p: GeoLatLng): [number, number] {
  const d = applyMapDisplayOffset(p);
  return [d.lat, d.lng];
}

export function markerToYandexPoint(marker: MapShopMarker): [number, number] {
  return [marker.lat, marker.lng];
}

export function isLocalMarketRoute(from: GeoLatLng, to: GeoLatLng): boolean {
  return haversineMeters(from, to) <= MAX_BOZOR_ROUTE_METERS;
}

export function resolveEntranceWgs84(
  markers: MapShopMarker[],
  shop: MapShopMarker,
): GeoLatLng {
  const block = shop.pin.block.toUpperCase();
  const hit =
    markers.find((m) => m.pin.block.toUpperCase() === block && m.pin.stallSlot === "08") ??
    markers.find((m) => m.pin.block.toUpperCase() === block);
  if (hit) {
    return stripMapDisplayOffset({ lat: hit.lat, lng: hit.lng });
  }
  return { ...IPPODROM_CENTER };
}

/** GPS bozor tashqarisida bo‘lsa — do‘kon blokiga yaqin kirish nuqtasi. */
export function clampMarketRouteStart(
  start: GeoLatLng | null,
  goal: GeoLatLng,
  markers: MapShopMarker[],
  shop: MapShopMarker,
): GeoLatLng {
  if (start && isInsideIppodromGpsAcceptZone(start.lat, start.lng)) {
    return start;
  }
  if (start && isLocalMarketRoute(start, goal)) {
    return start;
  }
  return resolveEntranceWgs84(markers, shop);
}

export function shouldPreferOsmWalkingRoute(
  startWgs: GeoLatLng,
  goalWgs: GeoLatLng,
  mode: string,
): boolean {
  if (mode !== "pedestrian") return false;
  return (
    isInsideIppodromGeofence(goalWgs.lat, goalWgs.lng) &&
    isLocalMarketRoute(startWgs, goalWgs)
  );
}
