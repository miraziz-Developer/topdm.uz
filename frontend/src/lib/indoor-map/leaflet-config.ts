import { CRS, type LatLngBoundsExpression, type LatLngExpression } from "leaflet";

/** Ippodrom indoor grid (local coordinate system, same as SVG viewBox). */
export const IPPODROM_MAP_WIDTH = 420;
export const IPPODROM_MAP_HEIGHT = 260;

export const IPPODROM_BOUNDS: LatLngBoundsExpression = [
  [0, 0],
  [IPPODROM_MAP_HEIGHT, IPPODROM_MAP_WIDTH],
];

export const IPPODROM_CENTER: LatLngExpression = [IPPODROM_MAP_HEIGHT / 2, IPPODROM_MAP_WIDTH / 2];

export const IPPODROM_CRS = CRS.Simple;

export function toLatLng(point: { x: number; y: number }): LatLngExpression {
  return [point.y, point.x];
}

export function toLatLngs(points: Array<{ x: number; y: number }>): LatLngExpression[] {
  return points.map((point) => toLatLng(point));
}

export function boundsFromRect(x: number, y: number, width: number, height: number): LatLngBoundsExpression {
  return [
    [y, x],
    [y + height, x + width],
  ];
}
