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

export async function suggestWithYandexBrowser(query: string): Promise<ResolvedAddress[]> {
  const apiKey = resolveYandexMapsApiKey();
  if (!apiKey) return [];

  try {
    const ymaps = await loadYandexMaps(apiKey);
    const text = withTashkentContext(query);
    const res = await runYmapsGeocode(ymaps, text, 6);
    if (!res) return [];
    const out: ResolvedAddress[] = [];
    const len = Math.min(res.geoObjects.getLength(), 6);
    for (let i = 0; i < len; i++) {
      const obj = res.geoObjects.get(i);
      if (!obj) continue;
      const hit = parseGeocodeResult(obj, text);
      if (hit) out.push(hit);
    }
    return out;
  } catch {
    return [];
  }
}
