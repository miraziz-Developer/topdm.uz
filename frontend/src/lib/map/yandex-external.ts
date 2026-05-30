import { stripMapDisplayOffset, type GeoLatLng } from "@/lib/geo/market-geo";
import type { MapShopMarker } from "@/lib/shop-location";
import type { YandexTransportMode } from "@/lib/map/yandex-transport-modes";

export function markerWgs84(marker: MapShopMarker): GeoLatLng {
  return stripMapDisplayOffset({ lat: marker.lat, lng: marker.lng });
}

function formatCoord(n: number): string {
  return n.toFixed(6);
}

/** Yandex Maps veb — marshrut (GPS dan). */
export function buildYandexMapsRouteUrl(
  destination: GeoLatLng,
  mode: YandexTransportMode = "pedestrian",
): string {
  const rtt = mode === "auto" ? "auto" : mode === "masstransit" ? "mt" : "pd";
  const dest = `${formatCoord(destination.lat)},${formatCoord(destination.lng)}`;
  return `https://yandex.ru/maps/?rtext=~${dest}&rtt=${rtt}`;
}

/** Ikki nuqta orasida marshrut. */
export function buildYandexMapsRouteFromToUrl(
  from: GeoLatLng,
  to: GeoLatLng,
  mode: YandexTransportMode = "pedestrian",
): string {
  const rtt = mode === "auto" ? "auto" : mode === "masstransit" ? "mt" : "pd";
  const a = `${formatCoord(from.lat)},${formatCoord(from.lng)}`;
  const b = `${formatCoord(to.lat)},${formatCoord(to.lng)}`;
  return `https://yandex.ru/maps/?rtext=${a}~${b}&rtt=${rtt}`;
}

/** Yandex Navigator ilovasi (mobil). */
export function buildYandexNaviUrl(destination: GeoLatLng): string {
  return `yandexnavi://build_route_on_map?lat_to=${formatCoord(destination.lat)}&lon_to=${formatCoord(destination.lng)}`;
}

/** Do‘kon nuqtasi — Yandex xaritada ochish. */
export function buildYandexMapsPointUrl(destination: GeoLatLng, zoom = 18): string {
  const pt = `${formatCoord(destination.lng)},${formatCoord(destination.lat)}`;
  return `https://yandex.ru/maps/?pt=${pt}&z=${zoom}&l=map`;
}

export function openYandexNavigation(
  destination: GeoLatLng,
  options?: { mode?: YandexTransportMode; from?: GeoLatLng | null },
): void {
  if (typeof window === "undefined") return;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const navi = buildYandexNaviUrl(destination);
    window.location.href = navi;
    window.setTimeout(() => {
      const web = options?.from
        ? buildYandexMapsRouteFromToUrl(options.from, destination, options?.mode)
        : buildYandexMapsRouteUrl(destination, options?.mode);
      window.open(web, "_blank", "noopener,noreferrer");
    }, 700);
    return;
  }

  const url = options?.from
    ? buildYandexMapsRouteFromToUrl(options.from, destination, options?.mode)
    : buildYandexMapsRouteUrl(destination, options?.mode);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function shopPageHref(marker: MapShopMarker): string {
  if (marker.slug) return `/shop/${encodeURIComponent(marker.slug)}`;
  return `/map?merchant_id=${encodeURIComponent(marker.id)}&focus=true`;
}
