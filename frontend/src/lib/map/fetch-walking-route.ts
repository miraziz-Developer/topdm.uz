import type { GeoLatLng } from "@/lib/geo/market-geo";

type WalkingRouteResponse = {
  coordinates?: GeoLatLng[];
  distance_m?: number | null;
  provider?: string | null;
  detail?: string;
};

/**
 * Piyoda marshrut (ORS / GraphHopper / OSM.de) — same-origin API.
 * `from` / `to` must be true WGS84 (strip display calibration before calling).
 */
export async function fetchWalkingRoutePolyline(
  from: GeoLatLng,
  to: GeoLatLng,
  options?: { signal?: AbortSignal },
): Promise<{
  coordinates: GeoLatLng[];
  distanceM: number | null;
  provider: string | null;
} | null> {
  const params = new URLSearchParams({
    from_lat: String(from.lat),
    from_lng: String(from.lng),
    to_lat: String(to.lat),
    to_lng: String(to.lng),
  });

  let res: Response;
  try {
    res = await fetch(`/api/map/walking-route?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: options?.signal,
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let body: WalkingRouteResponse;
  try {
    body = (await res.json()) as WalkingRouteResponse;
  } catch {
    return null;
  }

  const coords = body.coordinates ?? [];
  if (coords.length < 2) return null;

  return {
    coordinates: coords,
    distanceM: typeof body.distance_m === "number" && Number.isFinite(body.distance_m) ? body.distance_m : null,
    provider: typeof body.provider === "string" ? body.provider : null,
  };
}
