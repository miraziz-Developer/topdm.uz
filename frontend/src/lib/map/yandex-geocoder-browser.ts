"use client";

import { loadYandexMaps, resolveYandexMapsApiKey } from "@/lib/map/yandex-maps-loader";
import type { ResolvedAddress } from "@/lib/map/yandex-geocoder-client";

function withTashkentContext(query: string): string {
  const q = query.trim();
  if (/toshkent|tashkent|тошкент|узбекистан|o'zbekiston/i.test(q)) return q;
  return `${q}, Toshkent, Uzbekistan`;
}

type GeocodeCollection = {
  geoObjects: {
    get: (index: number) => GeocodeObject | null;
    getLength: () => number;
  };
};

type GeocodeObject = {
  geometry: { getCoordinates: () => number[] };
  properties: { get: (key: string) => unknown };
  getAddressLine?: () => string;
};

function parseGeocodeResult(obj: GeocodeObject, fallback: string): ResolvedAddress | null {
  const coords = obj.geometry.getCoordinates();
  if (!coords || coords.length < 2) return null;
  const lat = coords[0]!;
  const lng = coords[1]!;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const label =
    (typeof obj.getAddressLine === "function" ? obj.getAddressLine() : null) ||
    String(obj.properties.get("text") ?? fallback);
  return { lat, lng, label };
}

async function runYmapsGeocode(
  ymaps: typeof globalThis.ymaps,
  text: string,
  results: number,
): Promise<GeocodeCollection | null> {
  if (!ymaps) return null;

  const geocodeFn = (ymaps as { geocode?: (q: string, o?: object) => Promise<GeocodeCollection> }).geocode;
  if (typeof geocodeFn !== "function") return null;

  return geocodeFn(text, {
    results,
    boundedBy: [
      [41.15, 69.05],
      [41.45, 69.45],
    ],
    strictBounds: false,
  });
}

/** Yandex Maps JS API geocode — HTTP Geocoder kaliti shart emas. */
export async function geocodeWithYandexBrowser(query: string): Promise<ResolvedAddress | null> {
  const apiKey = resolveYandexMapsApiKey();
  if (!apiKey) return null;

  try {
    const ymaps = await loadYandexMaps(apiKey);
    const text = withTashkentContext(query);
    const res = await runYmapsGeocode(ymaps, text, 5);
    if (!res?.geoObjects.getLength()) return null;
    const first = res.geoObjects.get(0);
    if (!first) return null;
    return parseGeocodeResult(first, text);
  } catch {
    return null;
  }
}

function collectGeocodeHits(res: GeocodeCollection | null, fallback: string, max = 10): ResolvedAddress[] {
  if (!res) return [];
  const out: ResolvedAddress[] = [];
  const len = Math.min(res.geoObjects.getLength(), max);
  for (let i = 0; i < len; i++) {
    const obj = res.geoObjects.get(i);
    if (!obj) continue;
    const hit = parseGeocodeResult(obj, fallback);
    if (hit) out.push(hit);
  }
  return out;
}

export async function suggestWithYandexBrowser(query: string): Promise<ResolvedAddress[]> {
  const apiKey = resolveYandexMapsApiKey();
  if (!apiKey) return [];

  try {
    const ymaps = await loadYandexMaps(apiKey);
    const raw = query.trim();
    const variants = raw ? [raw, withTashkentContext(raw)] : [];
    const merged: ResolvedAddress[] = [];
    const seen = new Set<string>();

    for (const text of variants) {
      const res = await runYmapsGeocode(ymaps, text, 10);
      for (const hit of collectGeocodeHits(res, text, 10)) {
        const key = `${hit.lat.toFixed(4)}|${hit.lng.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(hit);
      }
      if (merged.length >= 4) break;
    }
    return merged;
  } catch {
    return [];
  }
}
