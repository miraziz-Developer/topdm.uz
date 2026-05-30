import { NextRequest, NextResponse } from "next/server";

import {
  fetchYandexGeocodeSuggestions,
  resolveYandexGeocode,
} from "@/lib/server/yandex-geocoder";

/**
 * Yandex Geocoder / Geosuggest — joy nomi bo‘yicha start (Metro Chilonzor va h.k.).
 * GET ?mode=suggest&q=metro
 * GET ?mode=resolve&q=Metro+Chilonzor,+Toshkent
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") ?? "resolve";
  const q = (sp.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ detail: "Query too short", results: [], point: null }, { status: 400 });
  }

  if (mode === "suggest") {
    const results = await fetchYandexGeocodeSuggestions(q, 8);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  const point = await resolveYandexGeocode(q);
  if (!point) {
    return NextResponse.json(
      { detail: "Address not found", point: null },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { point },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
