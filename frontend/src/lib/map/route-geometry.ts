import { applyMapDisplayOffset, indoorPixelToWgs84, type GeoLatLng } from "@/lib/geo/market-geo";
import { haversineMeters } from "@/lib/map/route-distance";
import type { MapShopMarker } from "@/lib/shop-location";

const MIN_SEGMENT_DEG = 1e-7;
/** Ulanish segmenti faqat qisqa masofada (yo‘lak yonidagi nuqta). */
const MAX_CONNECTOR_M = 65;

function isDistinct(a: GeoLatLng, b: GeoLatLng): boolean {
  return Math.abs(a.lat - b.lat) > MIN_SEGMENT_DEG || Math.abs(a.lng - b.lng) > MIN_SEGMENT_DEG;
}

function dedupePath(path: GeoLatLng[]): GeoLatLng[] {
  const out: GeoLatLng[] = [];
  for (const point of path) {
    const last = out[out.length - 1];
    if (!last || isDistinct(last, point)) out.push(point);
  }
  return out.length >= 2 ? out : [];
}

function nearestOnPath(
  path: GeoLatLng[],
  point: GeoLatLng,
): { index: number; distanceM: number } {
  let bestIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    const d = haversineMeters(point, path[i]!);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  return { index: bestIdx, distanceM: bestD };
}

/**
 * OSM/Yandex polyline + A/B: yo‘l bo‘yicha qirqiladi, qisqa ulanish (bino orqali emas).
 */
export function finalizeStreetRoutePath(
  path: GeoLatLng[],
  start: GeoLatLng | null | undefined,
  goal: GeoLatLng | null | undefined,
): GeoLatLng[] {
  if (path.length < 2) return [];

  let slice = path;

  if (start) {
    const nearStart = nearestOnPath(slice, start);
    if (nearStart.distanceM < 250) {
      slice = slice.slice(nearStart.index);
    }
  }

  if (goal) {
    const nearGoal = nearestOnPath(slice, goal);
    if (nearGoal.distanceM < 250) {
      slice = slice.slice(0, nearGoal.index + 1);
    }
  }

  if (slice.length < 2) slice = path;

  const out = [...slice];

  if (start) {
    const d0 = haversineMeters(start, out[0]!);
    if (d0 > 6 && d0 <= MAX_CONNECTOR_M) {
      out.unshift(start);
    } else if (d0 <= 6) {
      out[0] = start;
    }
  }

  if (goal) {
    const last = out[out.length - 1]!;
    const d1 = haversineMeters(goal, last);
    if (d1 > 6 && d1 <= MAX_CONNECTOR_M) {
      out.push(goal);
    } else if (d1 <= 6) {
      out[out.length - 1] = goal;
    }
  }

  return dedupePath(out);
}


/** Indoor graph pixels → WGS84, anchored to real stall / entrance coordinates. */
export function buildAnchoredRoutePath(
  points: Array<{ x: number; y: number }>,
  anchors?: {
    start?: GeoLatLng | null;
    goal?: GeoLatLng | null;
  },
): GeoLatLng[] {
  if (!points.length) return [];

  const path = points.map((p) => applyMapDisplayOffset(indoorPixelToWgs84(p.x, p.y)));
  return finalizeStreetRoutePath(path, anchors?.start, anchors?.goal);
}

export function resolveRouteAnchors(
  markers: MapShopMarker[],
  selectedMarker: MapShopMarker | null,
  fromNodeId: string,
): { start: GeoLatLng | null; goal: GeoLatLng | null } {
  const goal = selectedMarker ? { lat: selectedMarker.lat, lng: selectedMarker.lng } : null;

  const blockMatch = fromNodeId.match(/entrance-([A-D])/i);
  if (!blockMatch) {
    return { start: null, goal };
  }

  const block = blockMatch[1].toUpperCase();
  const entranceMarker =
    markers.find((m) => m.pin.block.toUpperCase() === block && m.pin.stall === "08") ??
    markers.find((m) => m.pin.block.toUpperCase() === block);

  const start = entranceMarker ? { lat: entranceMarker.lat, lng: entranceMarker.lng } : null;
  return { start, goal };
}

export function formatRouteDistanceUnits(distance: number | null | undefined): number | null {
  if (distance == null || !Number.isFinite(distance)) return null;
  return Math.abs(distance);
}

/** OSM polyline juda uzun bo‘lsa xarita va bounds uchun soddalashtiriladi. */
export function simplifyRoutePath(path: GeoLatLng[], maxPoints = 350): GeoLatLng[] {
  if (path.length <= maxPoints) return path;
  const step = Math.ceil(path.length / maxPoints);
  const out: GeoLatLng[] = [path[0]!];
  for (let i = step; i < path.length - 1; i += step) {
    out.push(path[i]!);
  }
  const last = path[path.length - 1]!;
  if (out[out.length - 1]!.lat !== last.lat || out[out.length - 1]!.lng !== last.lng) {
    out.push(last);
  }
  return out;
}

/** @deprecated Use {@link finalizeStreetRoutePath} */
export function anchorRouteEndpoints(
  path: GeoLatLng[],
  anchors?: { start?: GeoLatLng | null; goal?: GeoLatLng | null },
): GeoLatLng[] {
  return finalizeStreetRoutePath(path, anchors?.start, anchors?.goal);
}

/** Indoor segment from the point nearest to the street route end → stall. */
export function sliceIndoorTailAfterStreet(
  streetPath: GeoLatLng[],
  indoorPath: GeoLatLng[],
): GeoLatLng[] {
  if (streetPath.length < 2 || indoorPath.length < 2) return [];
  const streetEnd = streetPath[streetPath.length - 1];
  let bestIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < indoorPath.length; i += 1) {
    const d = haversineMeters(streetEnd, indoorPath[i]!);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  const tail = indoorPath.slice(bestIdx);
  return tail.length >= 2 ? tail : [];
}
