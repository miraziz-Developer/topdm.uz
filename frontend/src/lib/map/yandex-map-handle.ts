import { applyMapDisplayOffset, type GeoLatLng } from "@/lib/geo/market-geo";
import type { YandexMapLayerId } from "@/lib/map/yandex-map-types";
import type { YandexTransportMode } from "@/lib/map/yandex-transport-modes";

export type BuildRouteToShopOptions = {
  from: GeoLatLng;
  shopId: string;
  mode?: YandexTransportMode;
};

export type BuildRouteToShopResult = {
  ok: boolean;
  distanceM: number | null;
  error: string | null;
};

/** Imperative Yandex map API for parent (fly, fit bounds, layers, route). */

export type YandexMapHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitToPoints: (points: Array<{ lat: number; lng: number }>) => void;
  setMapLayer: (layer: YandexMapLayerId) => void;
  setTrafficVisible: (on: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getZoom: () => number;
  isMapReady: () => boolean;
  buildRouteToShop: (opts: BuildRouteToShopOptions) => Promise<BuildRouteToShopResult>;
};

export function createYandexMapHandle(
  map: ymaps.Map | null,
  trafficRef: { current: InstanceType<typeof ymaps.control.TrafficControl> | null } | undefined,
  actions: {
    isMapReady: () => boolean;
    buildRouteToShop: (opts: BuildRouteToShopOptions) => Promise<BuildRouteToShopResult>;
  },
): YandexMapHandle | null {
  if (!map) return null;

  return {
    flyTo(lat, lng, zoom = 17) {
      map.setCenter([lat, lng], zoom, { duration: 420, flying: true, checkZoomRange: true });
    },
    fitToPoints(points) {
      if (!points.length) return;
      const yandexPts = points.map((p) => {
        const d = applyMapDisplayOffset(p);
        return [d.lat, d.lng] as [number, number];
      });
      if (yandexPts.length === 1) {
        map.setCenter(yandexPts[0]!, 17, { duration: 420, flying: true });
        return;
      }
      const bounds = ymaps.util.bounds.fromPoints(yandexPts);
      map.setBounds(bounds, {
        checkZoomRange: true,
        duration: 480,
        flying: true,
        zoomMargin: 72,
      });
    },
    setMapLayer(layer) {
      map.setType(layer);
    },
    setTrafficVisible(on) {
      const tc = trafficRef?.current;
      if (!tc) return;
      try {
        const ctrl = tc as {
          state?: {
            set: (key: string | Record<string, boolean>, value?: boolean) => void;
          };
          getProvider?: (key: string) => { show?: () => void; hide?: () => void } | null;
        };
        if (ctrl.state?.set) {
          ctrl.state.set("trafficVisible", on);
          return;
        }
        const provider = ctrl.getProvider?.("traffic#actual");
        if (on && typeof provider?.show === "function") provider.show();
        else if (!on && typeof provider?.hide === "function") provider.hide();
      } catch {
        /* TrafficControl mavjud emas yoki API farq qiladi */
      }
    },
    zoomIn() {
      map.setZoom(map.getZoom() + 1, { duration: 220, checkZoomRange: true });
    },
    zoomOut() {
      map.setZoom(map.getZoom() - 1, { duration: 220, checkZoomRange: true });
    },
    getZoom() {
      return map.getZoom();
    },
    isMapReady: actions.isMapReady,
    buildRouteToShop: actions.buildRouteToShop,
  };
}
