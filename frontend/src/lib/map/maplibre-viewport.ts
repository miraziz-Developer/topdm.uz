import type { MapRef } from "react-map-gl/maplibre";

import type { GeoLatLng } from "@/lib/geo/market-geo";
import type { MapShopMarker } from "@/lib/shop-location";

import type { MapChromeInsets } from "./spatial-viewport";

export const MAPLIBRE_FOCUS_ZOOM = 17.5;
export const MAPLIBRE_MAX_FIT_ZOOM = 18;

export function chromeToMapLibrePadding(chrome: MapChromeInsets): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  return {
    top: chrome.top,
    right: chrome.right,
    bottom: chrome.bottom,
    left: chrome.left,
  };
}

type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number };

function extendBounds(bounds: Bounds, p: GeoLatLng): void {
  bounds.minLng = Math.min(bounds.minLng, p.lng);
  bounds.maxLng = Math.max(bounds.maxLng, p.lng);
  bounds.minLat = Math.min(bounds.minLat, p.lat);
  bounds.maxLat = Math.max(bounds.maxLat, p.lat);
}

/** Bounds uchun faqat namunaviy nuqtalar (minglab nuqta → stack overflow oldini olish). */
function extendBoundsFromRoute(bounds: Bounds, routePath: GeoLatLng[]): void {
  if (!routePath.length) return;
  const maxSamples = 120;
  const step = routePath.length > maxSamples ? Math.ceil(routePath.length / maxSamples) : 1;
  for (let i = 0; i < routePath.length; i += step) {
    extendBounds(bounds, routePath[i]!);
  }
  extendBounds(bounds, routePath[0]!);
  extendBounds(bounds, routePath[routePath.length - 1]!);
}

function computeSpatialBounds(options: {
  routePath?: GeoLatLng[];
  focusPoint?: GeoLatLng | null;
  markers?: MapShopMarker[];
}): Bounds | null {
  let bounds: Bounds | null = null;

  const touch = (p: GeoLatLng) => {
    if (!bounds) {
      bounds = { minLng: p.lng, maxLng: p.lng, minLat: p.lat, maxLat: p.lat };
      return;
    }
    extendBounds(bounds, p);
  };

  if (options.routePath?.length) {
    extendBoundsFromRoute(
      bounds ?? (bounds = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }),
      options.routePath,
    );
  }

  if (options.focusPoint) touch(options.focusPoint);

  if (options.markers?.length && !options.routePath?.length) {
    for (const m of options.markers) {
      touch({ lat: m.lat, lng: m.lng });
    }
  }

  if (!bounds || !Number.isFinite(bounds.minLng)) return null;
  return bounds;
}

export function fitMapLibreToSpatialContent(
  map: MapRef,
  options: {
    routePath?: GeoLatLng[];
    focusPoint?: GeoLatLng | null;
    markers?: MapShopMarker[];
    chrome: MapChromeInsets;
    maxZoom?: number;
    duration?: number;
  },
): void {
  const inner = map.getMap();
  if (!inner) return;

  const padding = chromeToMapLibrePadding(options.chrome);
  const maxZoom = options.maxZoom ?? MAPLIBRE_MAX_FIT_ZOOM;
  const duration = options.duration ?? 1500;

  const bounds = computeSpatialBounds(options);

  if (bounds && bounds.minLng !== bounds.maxLng && bounds.minLat !== bounds.maxLat) {
    inner.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      { padding, maxZoom, duration, essential: true },
    );
    return;
  }

  if (options.focusPoint) {
    flyMapLibreToVisiblePoint(map, options.focusPoint, MAPLIBRE_FOCUS_ZOOM, options.chrome, duration);
    return;
  }

  if (options.markers?.length === 1) {
    const m = options.markers[0];
    flyMapLibreToVisiblePoint(map, { lat: m.lat, lng: m.lng }, MAPLIBRE_FOCUS_ZOOM, options.chrome, duration);
  }
}

export function flyMapLibreToVisiblePoint(
  map: MapRef,
  point: GeoLatLng,
  zoom: number,
  chrome: MapChromeInsets,
  duration = 1500,
): void {
  map.flyTo({
    center: [point.lng, point.lat],
    zoom,
    duration,
    essential: true,
    padding: chromeToMapLibrePadding(chrome),
  });
}
