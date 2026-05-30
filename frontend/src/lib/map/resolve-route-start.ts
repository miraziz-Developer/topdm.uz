import { stripMapDisplayOffset, type GeoLatLng } from "@/lib/geo/market-geo";

type RouteStartMode = "entrance" | "gps" | "stall" | "address";

/** Marshrut boshlanishi: rejim bo‘yicha ustuvorlik (GPS/joy qidiruv bloklanmasin). */
export function resolveRouteStartWgs84(args: {
  routeStartMode: RouteStartMode;
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  manualMapStart: { lat: number; lng: number } | null;
}): GeoLatLng | null {
  const hasGps =
    args.userLat != null &&
    args.userLng != null &&
    Number.isFinite(args.userLat) &&
    Number.isFinite(args.userLng);

  if (args.routeStartMode === "gps" && hasGps) {
    return { lat: args.userLat!, lng: args.userLng! };
  }

  if ((args.routeStartMode === "address" || args.routeStartMode === "entrance") && args.manualMapStart) {
    return stripMapDisplayOffset(args.manualMapStart);
  }

  if (args.manualMapStart) {
    return stripMapDisplayOffset(args.manualMapStart);
  }

  if (hasGps) {
    return { lat: args.userLat!, lng: args.userLng! };
  }

  return null;
}
