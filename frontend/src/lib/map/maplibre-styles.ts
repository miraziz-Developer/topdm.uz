import type { StyleSpecification } from "maplibre-gl";

/** Global OSM vector style — no API key, works in Central Asia. */
export const OPENFREEMAP_LIBERTY_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/** Guaranteed raster fallback (Carto light) when vector styles fail. */
export const CARTO_LIGHT_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-light": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap © CARTO",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "carto-light-layer",
      type: "raster",
      source: "carto-light",
    },
  ],
};

/** Yandex raster tiles embedded inside our own map page. */
export const YANDEX_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "yandex-base": {
      type: "raster",
      tiles: [
        "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&lang=uz_UZ&scale=1",
      ],
      tileSize: 256,
      attribution: "© Yandex © OpenStreetMap contributors",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "yandex-base-layer",
      type: "raster",
      source: "yandex-base",
    },
  ],
};

const PLACEHOLDER_KEYS = new Set([
  "",
  "your-maptiler-key",
  "pk.your-maptiler-public-token",
  "your_maptiler_key",
]);

export function resolveMapTilerKey(explicit?: string | null): string {
  return (
    explicit?.trim() ||
    process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ||
    ""
  );
}

function resolvePreferredProvider(): string {
  const raw = (process.env.NEXT_PUBLIC_MAP_PROVIDER || "yandex-maps-api").trim().toLowerCase();
  if (raw === "yandex-maps-api" || raw === "yandex") return "yandex";
  return raw;
}

function isUsableMapTilerKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized || PLACEHOLDER_KEYS.has(normalized)) return false;
  if (normalized.startsWith("your-") || normalized.includes("example")) return false;
  return normalized.length >= 8;
}

export type MapLibreStyleInput = string | StyleSpecification;

/** Prefer MapTiler satellite when key is valid; otherwise OpenFreeMap vector. */
export function resolveMapLibreStyleUrl(explicitKey?: string | null): MapLibreStyleInput {
  const provider = resolvePreferredProvider();
  if (provider === "yandex") {
    return YANDEX_RASTER_STYLE;
  }

  const key = resolveMapTilerKey(explicitKey);
  if (isUsableMapTilerKey(key)) {
    return `https://api.maptiler.com/maps/hybrid/style.json?key=${encodeURIComponent(key)}`;
  }
  return OPENFREEMAP_LIBERTY_STYLE;
}

export function resolveMapLibreRasterFallback(): StyleSpecification {
  return CARTO_LIGHT_RASTER_STYLE;
}
