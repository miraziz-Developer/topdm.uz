/** OpenStreetMap Nominatim — Yandex HTTP Geocoder ishlamaganda zaxira. */

export type OsmGeocodeHit = {
  lat: number;
  lng: number;
  label: string;
  title: string;
  subtitle: string;
};

function normalizeQuery(q: string): string {
  const trimmed = q.trim();
  if (/toshkent|tashkent|узбекистан|o'zbekiston/i.test(trimmed)) return trimmed;
  return `${trimmed}, Toshkent, Uzbekistan`;
}

async function nominatimSearch(query: string, limit: number): Promise<OsmGeocodeHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "uz");
  url.searchParams.set("viewbox", "69.05,41.45,69.45,41.15");
  url.searchParams.set("bounded", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "BozorliiiUZ/1.0 (map navigation)" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      name?: string;
      type?: string;
      class?: string;
    }>;
    return rows
      .map((row, i) => {
        const lat = Number.parseFloat(row.lat ?? "");
        const lng = Number.parseFloat(row.lon ?? "");
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const label = row.display_name?.trim() || row.name?.trim() || query;
        const title = row.name?.trim() || label.split(",")[0]?.trim() || query;
        const subtitle =
          label.length > title.length ? label.slice(title.length).replace(/^,\s*/, "") : "Toshkent";
        return { lat, lng, label, title, subtitle };
      })
      .filter((x): x is OsmGeocodeHit => x != null);
  } catch {
    return [];
  }
}

export async function searchOsmPlaces(text: string, limit = 8): Promise<OsmGeocodeHit[]> {
  const q = text.trim();
  if (q.length < 2) return [];

  const primary = await nominatimSearch(normalizeQuery(q), limit);
  if (primary.length) return primary;

  if (/metro|метро|chilonzor|chilonzor/i.test(q)) {
    const core = q.replace(/metro|метро/gi, "").trim() || q;
    const variants = [
      `Chilonzor metro station, Tashkent, Uzbekistan`,
      `метро ${core}, Ташкент`,
      `metro station ${core}, Tashkent`,
    ];
    for (const variant of variants) {
      const metro = await nominatimSearch(variant, limit);
      if (metro.length) return metro;
    }
  }

  return nominatimSearch(`${q}, Toshkent`, limit);
}

export async function resolveOsmPlace(query: string): Promise<OsmGeocodeHit | null> {
  const hits = await searchOsmPlaces(query, 1);
  return hits[0] ?? null;
}
