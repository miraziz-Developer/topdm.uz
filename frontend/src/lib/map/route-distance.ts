import type { GeoLatLng } from "@/lib/geo/market-geo";

const EARTH_RADIUS_M = 6_371_000;

export type RoutePathSource = "osm" | "indoor";

export function haversineMeters(a: GeoLatLng, b: GeoLatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthMeters(path: GeoLatLng[]): number {
  if (path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += haversineMeters(path[i - 1], path[i]);
  }
  return total;
}

export function formatMetersUz(meters: number): string {
  const m = Math.abs(meters);
  if (!Number.isFinite(m) || m < 1) return "0 m";
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatRouteDistanceLabel(args: {
  source: RoutePathSource;
  metersM?: number | null;
  indoorUnits?: number | null;
}): string | null {
  if (args.source === "osm") {
    const m = args.metersM;
    if (m != null && Number.isFinite(m) && m > 0) {
      return `≈ ${formatMetersUz(m)} (piyoda, xarita yo‘li)`;
    }
    return null;
  }

  const indoorM = args.metersM;
  if (indoorM != null && Number.isFinite(indoorM) && indoorM > 0) {
    return `≈ ${formatMetersUz(indoorM)} (bozor yo‘li, rasta koridorlari)`;
  }

  const units = args.indoorUnits;
  if (units != null && Number.isFinite(units) && units > 0) {
    return `≈ ${Math.abs(units).toFixed(1)} birlik (ichki sxema)`;
  }
  return null;
}

export function routeSourceCaption(source: RoutePathSource, provider?: string | null): string {
  if (source === "indoor") return "Ichki bozor grafi";
  if (provider === "openrouteservice") return "OpenRouteService • OSM yo‘laklari";
  if (provider === "graphhopper") return "GraphHopper • OSM yo‘laklari";
  if (provider === "yandex") return "Yandex Maps • piyoda marshrut";
  if (provider === "osm_foot" || provider === "osrm_public") return "OpenStreetMap • piyoda yo‘li";
  if (provider === "direct") return "Taxminiy chiziq (ko‘cha yo‘li topilmasa)";
  return "OpenStreetMap piyoda yo‘li";
}
