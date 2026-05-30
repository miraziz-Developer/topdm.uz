import { haversineMeters, type GeoLatLng } from "@/lib/geo/market-geo";

/** Navigatsiya rejimida xarita zoom darajasi (foydalanuvchini yaqinlashtirish). */
export const NAVIGATION_FOLLOW_ZOOM = 18;

const MIN_RECENTER_INTERVAL_MS = 700;
const MIN_RECENTER_DISTANCE_M = 4;

export type FollowRecenterGate = {
  lastAt: number;
  lastLat: number;
  lastLng: number;
};

export function createFollowRecenterGate(): FollowRecenterGate {
  return { lastAt: 0, lastLat: 0, lastLng: 0 };
}

/** GPS yangilanishida markazga qaytarish kerakmi (throttle + minimal masofa). */
export function shouldRecenterForFollow(
  gate: FollowRecenterGate,
  lat: number,
  lng: number,
  force = false,
): boolean {
  if (force) return true;
  const now = Date.now();
  if (gate.lastAt > 0 && now - gate.lastAt < MIN_RECENTER_INTERVAL_MS) {
    return false;
  }
  if (gate.lastAt > 0) {
    const moved = haversineMeters({ lat: gate.lastLat, lng: gate.lastLng }, { lat, lng });
    if (moved < MIN_RECENTER_DISTANCE_M) return false;
  }
  gate.lastAt = now;
  gate.lastLat = lat;
  gate.lastLng = lng;
  return true;
}
