import type { MapPoint } from "@/lib/indoor-map/types";

export function pointsToSvgPath(points: MapPoint[]) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y}${rest.map((point) => ` L ${point.x} ${point.y}`).join("")}`;
}

export function roundPoint(point: MapPoint, precision = 1): MapPoint {
  const factor = 10 ** precision;
  return {
    x: Math.round(point.x * factor) / factor,
    y: Math.round(point.y * factor) / factor,
  };
}
