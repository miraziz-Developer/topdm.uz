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

const BROWSER_TIMEOUT_MS = 6000;
const MIN_GOOD_RESULTS = 3;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function dedupeSuggestions(rows: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const row of rows) {
    const key =
      row.lat != null && row.lng != null
        ? `${row.lat.toFixed(4)}|${row.lng.toFixed(4)}`
        : row.query.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function browserHitsToSuggestions(hits: ResolvedAddress[]): AddressSuggestion[] {
  return hits.map((hit, i) => ({
    id: `ymaps-${i}-${hit.lat}`,
    title: hit.label.split(",")[0]?.trim() || hit.label,
    subtitle: hit.label,
    query: hit.label,
    lat: hit.lat,
    lng: hit.lng,
  }));
}

/** Server (OSM + Yandex HTTP) va brauzer Yandex JS natijalarini birlashtiradi. */
export async function fetchAddressSuggestions(text: string): Promise<AddressSuggestion[]> {
  const q = text.trim();
  if (q.length < 2) return [];

  let serverRows: AddressSuggestion[] = [];
  try {
    const res = await fetch(`/api/map/geocode?mode=suggest&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = (await res.json()) as { results?: AddressSuggestion[] };
      serverRows = data.results ?? [];
    }
  } catch {
    /* server unreachable */
  }

  let browserRows: AddressSuggestion[] = [];
  if (serverRows.length < MIN_GOOD_RESULTS) {
    const browser = await withTimeout(suggestWithYandexBrowser(q), BROWSER_TIMEOUT_MS);
    browserRows = browser?.length ? browserHitsToSuggestions(browser) : [];
  }

  const merged = dedupeSuggestions([...serverRows, ...browserRows]);
  return merged.slice(0, 10);
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
