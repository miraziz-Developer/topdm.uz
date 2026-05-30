import { NextRequest, NextResponse } from "next/server";

import { resolveWalkingRoute } from "@/lib/server/walking-route-providers";

export const runtime = "nodejs";

function clampCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Piyoda marshrut (OSM yo‘laklari). OSRM server shart emas.
 * Ustuvor: Yandex Router (YANDEX_ROUTER_API_KEY). Zaxira: ORS / OSM.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fromLat = Number(sp.get("from_lat"));
  const fromLng = Number(sp.get("from_lng"));
  const toLat = Number(sp.get("to_lat"));
  const toLng = Number(sp.get("to_lng"));

  if (!clampCoord(fromLat, fromLng) || !clampCoord(toLat, toLng)) {
    return NextResponse.json({ detail: "Invalid coordinates" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof resolveWalkingRoute>>;
  try {
    result = await resolveWalkingRoute(
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng },
    );
  } catch {
    return NextResponse.json({ detail: "Routing service unreachable" }, { status: 502 });
  }

  if (!result || result.coordinates.length < 2) {
    return NextResponse.json({
      detail: "No route found",
      coordinates: [],
      distance_m: null,
      provider: null,
    });
  }

  return NextResponse.json(
    {
      coordinates: result.coordinates,
      distance_m: result.distance_m,
      provider: result.provider,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    },
  );
}
