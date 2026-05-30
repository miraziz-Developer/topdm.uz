import type { MapStoreRecord } from "@/lib/map-stores";

export type GeoLatLng = { lat: number; lng: number };

/** Chilonzor Ippodrom Buyum Bozori — true geographic center (WGS84). */
export const IPPODROM_CENTER: GeoLatLng = { lat: 41.2346, lng: 69.1834 };

/** Abu Saxiy wholesale quarter node. */
export const ABU_SAXIY_CENTER: GeoLatLng = { lat: 41.2381, lng: 69.1765 };

export const IPPODROM_GEOFENCE: GeoLatLng[] = [
  { lat: 41.2325, lng: 69.1750 },
  { lat: 41.2325, lng: 69.1855 },
  { lat: 41.2395, lng: 69.1855 },
  { lat: 41.2395, lng: 69.1750 },
];

export const IPPODROM_INDOOR_WIDTH = 420;
export const IPPODROM_INDOOR_HEIGHT = 260;

const WGS84 = {
  minLat: 41.2325,
  maxLat: 41.2395,
  minLng: 69.1750,
  maxLng: 69.1855,
};

const MAP_LAT_OFFSET = Number.parseFloat(process.env.NEXT_PUBLIC_MAP_LAT_OFFSET ?? "0") || 0;
const MAP_LNG_OFFSET = Number.parseFloat(process.env.NEXT_PUBLIC_MAP_LNG_OFFSET ?? "0") || 0;

/** Legacy central-Tashkent coordinates (Xalqlar Do'stligi / National Park) — never use for map pins. */
export function isLegacyTashkentCoordinate(lat: number, lng: number): boolean {
  return lat > 41.28 || lng > 69.22;
}

/** Rough Ippodrom + Abu Saxiy cluster bounds (WGS84). */
export function isInsideIppodromGeofence(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (isLegacyTashkentCoordinate(lat, lng)) return false;
  return lat >= WGS84.minLat && lat <= WGS84.maxLat && lng >= WGS84.minLng && lng <= WGS84.maxLng;
}

/** Slightly expanded box for GPS acceptance (bozor chetidagi signal). ~120 m. */
const GPS_PAD = 0.0011;

/** Ikki nuqta orasidagi masofa (metr). */
export function haversineMeters(a: GeoLatLng, b: GeoLatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInsideIppodromGpsAcceptZone(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (isLegacyTashkentCoordinate(lat, lng)) return false;
  return (
    lat >= WGS84.minLat - GPS_PAD &&
    lat <= WGS84.maxLat + GPS_PAD &&
    lng >= WGS84.minLng - GPS_PAD &&
    lng <= WGS84.maxLng + GPS_PAD
  );
}

export function indoorPixelToWgs84(mapX: number, mapY: number): GeoLatLng {
  const latSpan = WGS84.maxLat - WGS84.minLat;
  const lngSpan = WGS84.maxLng - WGS84.minLng;
  const xRatio = Math.max(0, Math.min(1, mapX / IPPODROM_INDOOR_WIDTH));
  const yRatio = Math.max(0, Math.min(1, mapY / IPPODROM_INDOOR_HEIGHT));
  return {
    lat: WGS84.maxLat - yRatio * latSpan,
    lng: WGS84.minLng + xRatio * lngSpan,
  };
}

/** Provider calibration offset to align store pins with basemap tiles. */
export function applyMapDisplayOffset(point: GeoLatLng): GeoLatLng {
  return {
    lat: point.lat + MAP_LAT_OFFSET,
    lng: point.lng + MAP_LNG_OFFSET,
  };
}

/** Inverse of {@link applyMapDisplayOffset} — WGS84 as used by routing engines (ORS / OSM). */
export function stripMapDisplayOffset(point: GeoLatLng): GeoLatLng {
  return {
    lat: point.lat - MAP_LAT_OFFSET,
    lng: point.lng - MAP_LNG_OFFSET,
  };
}

export function resolveStorePosition(store: MapStoreRecord): GeoLatLng {
  if (Number.isFinite(store.map_x) && Number.isFinite(store.map_y) && store.map_x > 0) {
    return applyMapDisplayOffset(indoorPixelToWgs84(store.map_x, store.map_y));
  }
  if (
    store.latitude != null &&
    store.longitude != null &&
    Number.isFinite(store.latitude) &&
    Number.isFinite(store.longitude) &&
    Math.abs(store.latitude) > 1 &&
    !isLegacyTashkentCoordinate(store.latitude, store.longitude)
  ) {
    return applyMapDisplayOffset({ lat: store.latitude, lng: store.longitude });
  }
  return applyMapDisplayOffset({ ...IPPODROM_CENTER });
}

export function indoorRouteToWgs84Path(
  points: Array<{ x: number; y: number }>,
): GeoLatLng[] {
  return points.map((p) => indoorPixelToWgs84(p.x, p.y));
}
