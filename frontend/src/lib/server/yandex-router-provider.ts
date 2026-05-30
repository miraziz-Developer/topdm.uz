/**
 * Yandex Router API v2 — piyoda marshrut (Yandex Maps bilan bir xil motor).
 * @see https://yandex.com/maps-api/docs/router-api/examples.html
 */

export type WalkingRoutePoint = { lat: number; lng: number };

export type YandexWalkingRouteResult = {
  coordinates: WalkingRoutePoint[];
  distance_m: number | null;
  provider: "yandex";
};

type YandexRouteResponse = {
  route?: {
    legs?: Array<{
      status?: string;
      steps?: Array<{
        length?: number;
        mode?: string;
        polyline?: { points?: [number, number][] };
      }>;
    }>;
  };
  errors?: string[];
};

export function resolveYandexRouterApiKey(): string {
  return (
    process.env.YANDEX_ROUTER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ||
    ""
  );
}

/** Faqat alohida Router API kaliti — JS xarita kaliti (`NEXT_PUBLIC_*`) yetarli emas. */
export function isYandexRouterApiEnabled(): boolean {
  const key = process.env.YANDEX_ROUTER_API_KEY?.trim() ?? "";
  return key.length >= 8 && !key.startsWith("your-");
}

/** Piyoda rejimida waypoints: `lat,lng|lat,lng`; polyline nuqtalari ham [lat, lng]. */
export async function fetchYandexWalkingRoute(
  from: WalkingRoutePoint,
  to: WalkingRoutePoint,
  apiKey: string,
): Promise<YandexWalkingRouteResult | null> {
  const waypoints = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
  const url = new URL("https://api.routing.yandex.net/v2/route");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("waypoints", waypoints);
  url.searchParams.set("mode", "walking");

  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14_000);
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) return null;

  let data: YandexRouteResponse;
  try {
    data = (await res.json()) as YandexRouteResponse;
  } catch {
    return null;
  }

  if (data.errors?.length) return null;

  const legs = data.route?.legs ?? [];
  const coordinates: WalkingRoutePoint[] = [];
  let distance_m = 0;

  for (const leg of legs) {
    if (leg.status && leg.status !== "OK") continue;
    for (const step of leg.steps ?? []) {
      if (step.mode && step.mode !== "walking") continue;
      const pts = step.polyline?.points ?? [];
      if (typeof step.length === "number" && Number.isFinite(step.length)) {
        distance_m += step.length;
      }
      for (const pair of pts) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const lat = pair[0];
        const lng = pair[1];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const point = { lat, lng };
        const last = coordinates[coordinates.length - 1];
        if (
          last &&
          Math.abs(last.lat - lat) < 1e-7 &&
          Math.abs(last.lng - lng) < 1e-7
        ) {
          continue;
        }
        coordinates.push(point);
      }
    }
  }

  if (coordinates.length < 2) return null;

  return {
    coordinates,
    distance_m: distance_m > 0 ? distance_m : null,
    provider: "yandex",
  };
}
