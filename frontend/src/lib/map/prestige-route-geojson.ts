import type { GeoLatLng } from "@/lib/geo/market-geo";

export const PRESTIGE_ROUTE_SOURCE_ID = "prestige-route";
export const INDOOR_ROUTE_SOURCE_ID = "prestige-route-indoor";

export type RouteLineGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, never>;
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
  }>;
};

export function buildRouteLineGeoJson(path: GeoLatLng[]): RouteLineGeoJson {
  if (path.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: path.map((p) => [p.lng, p.lat]),
        },
      },
    ],
  };
}
