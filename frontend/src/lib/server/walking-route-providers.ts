/**
 * Server-only pedestrian routing (OSM footways). No self-hosted OSRM required.
 *
 * Priority:
 * 1. Yandex Router API — Yandex Maps bilan bir xil piyoda yo‘l (tavsiya)
 * 2. OpenRouteService
 * 3. GraphHopper
 * 4. OSM.de public foot router
 */

import {
  fetchYandexWalkingRoute,
  isYandexRouterApiEnabled,
  resolveYandexRouterApiKey,
} from "@/lib/server/yandex-router-provider";

export type WalkingRouteProviderId =
  | "yandex"
  | "openrouteservice"
  | "graphhopper"
  | "osm_foot"
  | "osrm_public"
  | "direct";

export type WalkingRouteResult = {
  coordinates: Array<{ lat: number; lng: number }>;
  distance_m: number | null;
  provider: WalkingRouteProviderId;
};

export type WalkingRoutePoint = { lat: number; lng: number };

const ROUTE_FETCH_MS = 14_000;
const DEFAULT_OSM_FOOT_BASE = "https://routing.openstreetmap.de/routed-foot";
const OSRM_PUBLIC_BASE = "https://router.project-osrm.org";

/** Har so‘rov uchun yangi timeout (umumiy signal 14s dan keyin hammasini uzardi). */
function routeFetchInit(headers?: HeadersInit): RequestInit {
  if (typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ROUTE_FETCH_MS), headers };
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ROUTE_FETCH_MS);
  return { signal: controller.signal, headers };
}

function toCoordsFromLngLatPairs(pairs: [number, number][]): WalkingRouteResult["coordinates"] {
  return pairs.map(([lng, lat]) => ({ lat, lng }));
}

/** OSRM-compatible JSON (OSM.de routed-foot, optional self-hosted foot router). */
async function fetchOsmFootRouter(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
  baseUrl: string,
): Promise<WalkingRouteResult | null> {
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;

  let res: Response;
  try {
    res = await fetch(url, routeFetchInit({ Accept: "application/json" }));
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: {
    code?: string;
    routes?: Array<{
      distance?: number;
      geometry?: { coordinates?: [number, number][] };
    }>;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }

  if (data.code && data.code !== "Ok") return null;
  const route0 = data.routes?.[0];
  const raw = route0?.geometry?.coordinates ?? [];
  if (raw.length < 2) return null;

  return {
    coordinates: toCoordsFromLngLatPairs(raw),
    distance_m:
      typeof route0?.distance === "number" && Number.isFinite(route0.distance)
        ? route0.distance
        : null,
    provider: "osm_foot",
  };
}

async function fetchOpenRouteService(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
  apiKey: string,
): Promise<WalkingRouteResult | null> {
  const url = new URL("https://api.openrouteservice.org/v2/directions/foot-walking");
  url.searchParams.set("start", `${from.lng},${from.lat}`);
  url.searchParams.set("end", `${to.lng},${to.lat}`);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...routeFetchInit({
        Accept: "application/geo+json;charset=UTF-8, application/json",
        Authorization: apiKey.trim(),
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: {
    features?: Array<{
      geometry?: { coordinates?: [number, number][] };
      properties?: { summary?: { distance?: number } };
    }>;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }

  const feature = data.features?.[0];
  const raw = feature?.geometry?.coordinates ?? [];
  if (raw.length < 2) return null;

  const dist = feature?.properties?.summary?.distance;
  return {
    coordinates: toCoordsFromLngLatPairs(raw),
    distance_m: typeof dist === "number" && Number.isFinite(dist) ? dist : null,
    provider: "openrouteservice",
  };
}

async function fetchGraphHopper(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
  apiKey: string,
): Promise<WalkingRouteResult | null> {
  const url = new URL("https://graphhopper.com/api/1/route");
  url.searchParams.set("point", `${from.lat},${from.lng}`);
  url.searchParams.append("point", `${to.lat},${to.lng}`);
  url.searchParams.set("profile", "foot");
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("key", apiKey.trim());

  let res: Response;
  try {
    res = await fetch(url.toString(), routeFetchInit({ Accept: "application/json" }));
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: {
    paths?: Array<{
      distance?: number;
      points?: { coordinates?: [number, number][] };
    }>;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }

  const path0 = data.paths?.[0];
  const raw = path0?.points?.coordinates ?? [];
  if (raw.length < 2) return null;

  return {
    coordinates: toCoordsFromLngLatPairs(raw),
    distance_m:
      typeof path0?.distance === "number" && Number.isFinite(path0.distance)
        ? path0.distance
        : null,
    provider: "graphhopper",
  };
}

async function snapToFootNetwork(
  point: WalkingRoutePoint,
  footBase: string,
): Promise<WalkingRoutePoint | null> {
  const base = footBase.replace(/\/$/, "");
  const url = `${base}/nearest/v1/foot/${point.lng},${point.lat}?number=3`;

  let res: Response;
  try {
    res = await fetch(url, routeFetchInit({ Accept: "application/json" }));
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: { waypoints?: Array<{ location?: [number, number]; distance?: number }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }

  const wp = data.waypoints?.[0];
  const loc = wp?.location;
  if (!loc || loc.length < 2) return null;

  return { lng: loc[0], lat: loc[1] };
}

function offsetCandidates(point: WalkingRoutePoint): WalkingRoutePoint[] {
  const d = 0.00025;
  return [
    point,
    { lat: point.lat + d, lng: point.lng },
    { lat: point.lat - d, lng: point.lng },
    { lat: point.lat, lng: point.lng + d },
    { lat: point.lat, lng: point.lng - d },
  ];
}

async function fetchOsrmPublic(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
): Promise<WalkingRouteResult | null> {
  const base = process.env.OSRM_PUBLIC_URL?.trim() || OSRM_PUBLIC_BASE;
  return fetchOsmFootRouter(from, to, base.replace(/\/$/, ""));
}

function haversineMeters(a: WalkingRoutePoint, b: WalkingRoutePoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function buildDirectFallback(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
): WalkingRouteResult {
  const steps = 48;
  const coordinates: WalkingRoutePoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    coordinates.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    });
  }
  return {
    coordinates,
    distance_m: haversineMeters(from, to),
    provider: "direct",
  };
}

async function tryWalkingRouteProviders(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
): Promise<WalkingRouteResult | null> {
  const orsKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  const ghKey = process.env.GRAPHHOPPER_API_KEY?.trim();
  const footBase = process.env.ROUTING_FOOT_URL?.trim() || DEFAULT_OSM_FOOT_BASE;
  const yandexRouterKey = process.env.YANDEX_ROUTER_API_KEY?.trim();

  const rOsm = await fetchOsmFootRouter(from, to, footBase);
  if (rOsm) return rOsm;

  const rOsrm = await fetchOsrmPublic(from, to);
  if (rOsrm) return rOsrm;

  if (orsKey) {
    const r = await fetchOpenRouteService(from, to, orsKey);
    if (r) return r;
  }

  if (ghKey) {
    const r = await fetchGraphHopper(from, to, ghKey);
    if (r) return r;
  }

  if (yandexRouterKey && isYandexRouterApiEnabled()) {
    const r = await fetchYandexWalkingRoute(from, to, yandexRouterKey);
    if (r) return r;
  }

  return null;
}

export async function resolveWalkingRoute(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
): Promise<WalkingRouteResult | null> {
  const footBase = process.env.ROUTING_FOOT_URL?.trim() || DEFAULT_OSM_FOOT_BASE;

  const direct = await tryWalkingRouteProviders(from, to);
  if (direct) return direct;

  const snappedFrom = await snapToFootNetwork(from, footBase);
  if (snappedFrom) {
    const r = await tryWalkingRouteProviders(snappedFrom, to);
    if (r) return r;
  }

  const snappedTo = await snapToFootNetwork(to, footBase);
  if (snappedTo) {
    const r = await tryWalkingRouteProviders(from, snappedTo);
    if (r) return r;
  }

  if (snappedFrom && snappedTo) {
    const r = await tryWalkingRouteProviders(snappedFrom, snappedTo);
    if (r) return r;
  }

  for (const candidateFrom of offsetCandidates(from)) {
    const r = await tryWalkingRouteProviders(candidateFrom, to);
    if (r) return r;
  }

  return buildDirectFallback(from, to);
}

export function providerLabel(id: WalkingRouteProviderId): string {
  switch (id) {
    case "yandex":
      return "Yandex Maps";
    case "openrouteservice":
      return "OpenRouteService";
    case "graphhopper":
      return "GraphHopper";
    case "osrm_public":
      return "OSRM";
    case "direct":
      return "Taxminiy yo‘l";
    default:
      return "OpenStreetMap";
  }
}
