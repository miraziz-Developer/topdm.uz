import type { MapPoint } from "@/lib/indoor-map/types";

export function toIsometric(point: MapPoint, depth = 0.22): MapPoint {
  return {
    x: point.x - point.y * depth,
    y: point.y + point.x * depth * 0.45,
  };
}

export function isometricTransform(depth = 0.22) {
  return `matrix(1 0 ${depth * 0.45} 1 0 0)`;
}
