/** OpenStreetMap Nominatim — Yandex HTTP Geocoder ishlamaganda zaxira. */

export type OsmGeocodeHit = {
  lat: number;
  lng: number;
  label: string;
  title: string;
  subtitle: string;
};

function withApostropheVariants(q: string): string[] {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed]);
  if (/y[oо]ngiyol/i.test(trimmed)) {
    variants.add(trimmed.replace(/y[oо]ngiyol/gi, "Yangiyo'l"));
    variants.add(trimmed.replace(/y[oо]ngiyol/gi, "Yangiyul"));
  }
  if (/chilonzor|chilonzor/i.test(trimmed)) {
    variants.add(trimmed.replace(/chilonzor/gi, "Chilonzor"));
  }
  if (/chorbog|chorbog/i.test(trimmed)) {
    variants.add(trimmed.replace(/chorbog/gi, "Chorbog'"));
  }
  return [...variants];
}

function normalizeQuery(q: string): string {
  const trimmed = q.trim();
  if (/toshkent|tashkent|узбекистан|o'zbekiston/i.test(trimmed)) return trimmed;
  return `${trimmed}, Toshkent, Uzbekistan`;
}

function dedupeHits(rows: OsmGeocodeHit[]): OsmGeocodeHit[] {
  const seen = new Set<string>();
  const out: OsmGeocodeHit[] = [];
  for (const row of rows) {
    const key = `${row.lat.toFixed(4)}|${row.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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

export async function searchOsmPlaces(text: string, limit = 10): Promise<OsmGeocodeHit[]> {
  const q = text.trim();
  if (q.length < 2) return [];

  const queries = new Set<string>();
  for (const variant of withApostropheVariants(q)) {
    queries.add(normalizeQuery(variant));
    queries.add(`${variant}, Toshkent`);
    queries.add(`${variant}, Tashkent, Uzbekistan`);
  }

  const collected: OsmGeocodeHit[] = [];
  for (const query of queries) {
    const batch = await nominatimSearch(query, limit);
    collected.push(...batch);
    if (collected.length >= limit) break;
  }

  if (collected.length) {
    return dedupeHits(collected).slice(0, limit);
  }

  if (/metro|метро/i.test(q)) {
    const core = q.replace(/metro|метро/gi, "").trim() || q;
    const variants = [
      `Chilonzor metro station, Tashkent, Uzbekistan`,
      `метро ${core}, Ташкент`,
      `metro station ${core}, Tashkent`,
      `${core} metro, Toshkent`,
    ];
    for (const variant of variants) {
      const metro = await nominatimSearch(variant, limit);
      collected.push(...metro);
      if (collected.length >= 2) break;
    }
    if (collected.length) return dedupeHits(collected).slice(0, limit);
  }

  const broad = await nominatimSearch(q, limit);
  return dedupeHits(broad).slice(0, limit);
}

export async function resolveOsmPlace(query: string): Promise<OsmGeocodeHit | null> {
  const hits = await searchOsmPlaces(query, 1);
  return hits[0] ?? null;
}
