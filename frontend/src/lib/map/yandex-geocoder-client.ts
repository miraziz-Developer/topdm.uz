import {
  geocodeWithYandexBrowser,
  suggestWithYandexBrowser,
} from "@/lib/map/yandex-geocoder-browser";

export type AddressSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  lat?: number;
  lng?: number;
};

export type ResolvedAddress = {
  lat: number;
  lng: number;
  label: string;
};

const BROWSER_TIMEOUT_MS = 4500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Server (OSM) birinchi — tez va ishonchli; keyin Yandex JS. */
export async function fetchAddressSuggestions(text: string): Promise<AddressSuggestion[]> {
  const q = text.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch(`/api/map/geocode?mode=suggest&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = (await res.json()) as { results?: AddressSuggestion[] };
      if (data.results?.length) return data.results;
    }
  } catch {
    /* server unreachable */
  }

  const browser = await withTimeout(suggestWithYandexBrowser(q), BROWSER_TIMEOUT_MS);
  if (!browser?.length) return [];

  return browser.map((hit, i) => ({
    id: `ymaps-${i}-${hit.lat}`,
    title: hit.label.split(",")[0]?.trim() || hit.label,
    subtitle: hit.label,
    query: hit.label,
    lat: hit.lat,
    lng: hit.lng,
  }));
}

export async function resolveAddressQuery(query: string): Promise<ResolvedAddress | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  try {
    const res = await fetch(`/api/map/geocode?mode=resolve&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = (await res.json()) as { point?: ResolvedAddress | null };
      if (data.point) return data.point;
    }
  } catch {
    /* fall through */
  }

  return withTimeout(geocodeWithYandexBrowser(q), BROWSER_TIMEOUT_MS);
}
