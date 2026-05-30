/** Yandex HTTP Geocoder + Geosuggest; zaxira: OSM Nominatim. */

import { searchOsmPlaces, resolveOsmPlace } from "@/lib/map/osm-geocoder";

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

function parseGeocoderPoint(pos: string): { lat: number; lng: number } | null {
  const parts = pos.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const lng = Number.parseFloat(parts[0]!);
  const lat = Number.parseFloat(parts[1]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Yandex Geosuggest — «Metro Chilonzor» kabi qidiruv. */
export async function fetchYandexGeocodeSuggestions(
  text: string,
  limit = 6,
): Promise<GeocodeSuggestion[]> {
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
    if (!res.ok) return await fallbackSuggestAll(q, limit);
    const data = (await res.json()) as {
      results?: Array<{
        title?: { text?: string };
        subtitle?: { text?: string };
        uri?: string;
      }>;
    };
    const rows = data.results ?? [];
    if (!rows.length) return await fallbackSuggestAll(q, limit);
    return rows
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
      .filter((x): x is GeocodeSuggestion => x != null)
      .slice(0, limit);
  } catch {
    return await fallbackSuggestAll(q, limit);
  }
}

async function fallbackSuggestAll(text: string, limit: number): Promise<GeocodeSuggestion[]> {
  const yandex = await resolveYandexGeocode(text);
  if (yandex) {
    return [
      {
        id: `yandex-${yandex.lat}-${yandex.lng}`,
        title: yandex.label.split(",")[0]?.trim() || yandex.label,
        subtitle: yandex.label,
        query: yandex.label,
        lat: yandex.lat,
        lng: yandex.lng,
      },
    ];
  }

  const osm = await searchOsmPlaces(text, limit);
  return osm.map((hit, i) => ({
    id: `osm-${i}-${hit.lat}`,
    title: hit.title,
    subtitle: hit.subtitle,
    query: hit.label,
    lat: hit.lat,
    lng: hit.lng,
  }));
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
