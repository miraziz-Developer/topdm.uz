/** Yandex HTTP Geocoder + Geosuggest; zaxira: OSM Nominatim (ko‘p natija). */

import { searchOsmPlaces, resolveOsmPlace } from "@/lib/map/osm-geocoder";

const TASHKENT_CENTER = { lat: 41.2995, lng: 69.2401 };

export type GeocodeSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  lat?: number;
  lng?: number;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
};

function resolveApiKey(): string | null {
  const key = (
    process.env.YANDEX_GEOCODER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ||
    ""
  );
  if (key.length < 8 || key.startsWith("your-")) return null;
  return key;
}

function dedupeSuggestions(rows: GeocodeSuggestion[]): GeocodeSuggestion[] {
  const seen = new Set<string>();
  const out: GeocodeSuggestion[] = [];
  for (const row of rows) {
    const key = row.lat != null && row.lng != null
      ? `${row.lat.toFixed(4)}|${row.lng.toFixed(4)}`
      : row.query.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function sortByTashkentBias(rows: GeocodeSuggestion[]): GeocodeSuggestion[] {
  const score = (row: GeocodeSuggestion) => {
    const blob = `${row.title} ${row.subtitle} ${row.query}`.toLowerCase();
    let points = 0;
    if (/toshkent|tashkent|тошкент/.test(blob)) points += 4;
    if (/toshkent viloyati|tashkent region/.test(blob)) points -= 1;
    if (row.lat != null && row.lng != null) {
      const dLat = row.lat - TASHKENT_CENTER.lat;
      const dLng = row.lng - TASHKENT_CENTER.lng;
      const dist = Math.hypot(dLat, dLng);
      points += Math.max(0, 3 - dist * 8);
    }
    return points;
  };
  return [...rows].sort((a, b) => score(b) - score(a));
}

function parseGeocoderPoint(pos: string): { lat: number; lng: number } | null {
  const parts = pos.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const lng = Number.parseFloat(parts[0]!);
  const lat = Number.parseFloat(parts[1]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function fetchYandexGeosuggestHttp(text: string, limit: number): Promise<GeocodeSuggestion[]> {
  const apikey = resolveApiKey();
  const q = text.trim();
  if (!apikey || q.length < 2) return [];

  const url = new URL("https://suggest-maps.yandex.ru/v1/suggest");
  url.searchParams.set("apikey", apikey);
  url.searchParams.set("text", q);
  url.searchParams.set("results", String(Math.min(10, Math.max(1, limit))));
  url.searchParams.set("lang", "uz_UZ");
  url.searchParams.set("types", "geo,street,house,metro,district");
  url.searchParams.set("bbox", "69.05,41.15~69.45,41.45");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        title?: { text?: string };
        subtitle?: { text?: string };
        uri?: string;
      }>;
    };
    return (data.results ?? [])
      .map((row, i) => {
        const title = row.title?.text?.trim() ?? "";
        const subtitle = row.subtitle?.text?.trim() ?? "";
        if (!title) return null;
        const query = subtitle ? `${title}, ${subtitle}` : title;
        return {
          id: row.uri?.trim() || `suggest-${i}-${query}`,
          title,
          subtitle,
          query,
        };
      })
      .filter((x): x is GeocodeSuggestion => x != null);
  } catch {
    return [];
  }
}

async function fetchYandexGeocodeMulti(text: string, limit: number): Promise<GeocodeSuggestion[]> {
  const apikey = resolveApiKey();
  const q = text.trim();
  if (!apikey || q.length < 2) return [];

  const url = new URL("https://geocode-maps.yandex.ru/1.x/");
  url.searchParams.set("apikey", apikey);
  url.searchParams.set("geocode", q.includes("Toshkent") || q.includes("Tashkent") ? q : `${q}, Toshkent`);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "uz_UZ");
  url.searchParams.set("results", String(Math.min(10, Math.max(1, limit))));
  url.searchParams.set("bbox", "69.05,41.15~69.45,41.45");
  url.searchParams.set("rspn", "0");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{
            GeoObject?: {
              Point?: { pos?: string };
              name?: string;
              metaDataProperty?: {
                GeocoderMetaData?: { text?: string };
              };
            };
          }>;
        };
      };
    };
    const members = data.response?.GeoObjectCollection?.featureMember ?? [];
    const out: GeocodeSuggestion[] = [];
    for (const [i, member] of members.entries()) {
      const obj = member.GeoObject;
      const pos = obj?.Point?.pos;
      if (!pos) continue;
      const parsed = parseGeocoderPoint(pos);
      if (!parsed) continue;
      const label =
        obj?.metaDataProperty?.GeocoderMetaData?.text?.trim() ||
        obj?.name?.trim() ||
        q;
      out.push({
        id: `yandex-multi-${i}-${parsed.lat}`,
        title: label.split(",")[0]?.trim() || label,
        subtitle: label,
        query: label,
        lat: parsed.lat,
        lng: parsed.lng,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Yandex Geosuggest + OSM + ko‘p natijali geocoder — bitta emas, ro‘yxat. */
export async function fetchYandexGeocodeSuggestions(
  text: string,
  limit = 8,
): Promise<GeocodeSuggestion[]> {
  const q = text.trim();
  if (q.length < 2) return [];

  const [yandexSuggest, yandexMulti, osmHits] = await Promise.all([
    fetchYandexGeosuggestHttp(q, limit),
    fetchYandexGeocodeMulti(q, limit),
    searchOsmPlaces(q, limit),
  ]);

  const osmSuggestions = osmHits.map((hit, i) => ({
    id: `osm-${i}-${hit.lat}`,
    title: hit.title,
    subtitle: hit.subtitle,
    query: hit.label,
    lat: hit.lat,
    lng: hit.lng,
  }));

  let merged = dedupeSuggestions([...yandexSuggest, ...yandexMulti, ...osmSuggestions]);
  merged = sortByTashkentBias(merged);

  if (merged.length >= 2) {
    return merged.slice(0, limit);
  }

  const single = await resolveYandexGeocode(q);
  if (single) {
    merged = dedupeSuggestions([
      ...merged,
      {
        id: `yandex-${single.lat}-${single.lng}`,
        title: single.label.split(",")[0]?.trim() || single.label,
        subtitle: single.label,
        query: single.label,
        lat: single.lat,
        lng: single.lng,
      },
    ]);
  }

  return sortByTashkentBias(merged).slice(0, limit);
}

/** Yandex Geocoder — tanlangan joy → WGS84. */
export async function resolveYandexGeocode(query: string): Promise<GeocodeResult | null> {
  const apikey = resolveApiKey();
  const q = query.trim();
  if (!apikey || q.length < 2) return null;

  const url = new URL("https://geocode-maps.yandex.ru/1.x/");
  url.searchParams.set("apikey", apikey);
  url.searchParams.set("geocode", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "uz_UZ");
  url.searchParams.set("results", "1");
  url.searchParams.set("bbox", "69.05,41.15~69.45,41.45");
  url.searchParams.set("rspn", "0");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return await resolveOsmPlace(q);
    const data = (await res.json()) as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{
            GeoObject?: {
              Point?: { pos?: string };
              name?: string;
              metaDataProperty?: {
                GeocoderMetaData?: { text?: string };
              };
            };
          }>;
        };
      };
    };
    const member = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const pos = member?.Point?.pos;
    if (!pos) return null;
    const parsed = parseGeocoderPoint(pos);
    if (!parsed) return null;
    const label =
      member.metaDataProperty?.GeocoderMetaData?.text?.trim() ||
      member.name?.trim() ||
      q;
    return { lat: parsed.lat, lng: parsed.lng, label };
  } catch {
    const osm = await resolveOsmPlace(q);
    if (!osm) return null;
    return { lat: osm.lat, lng: osm.lng, label: osm.label };
  }
}
