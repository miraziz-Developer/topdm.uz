import type { GeoLatLng } from "@/lib/geo/market-geo";
import type { MapShopMarker } from "@/lib/shop-location";

/** Bir xil nuqtadagi pinlarni aylana bo‘ylab biroz ajratadi (~12–20 m). */
export function spreadMarkerDisplayCoords(markers: MapShopMarker[]): Map<string, GeoLatLng> {
  const out = new Map<string, GeoLatLng>();
  const groups = new Map<string, MapShopMarker[]>();

  for (const m of markers) {
    const key = `${m.lat.toFixed(5)}:${m.lng.toFixed(5)}`;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      const m = group[0]!;
      out.set(m.id, { lat: m.lat, lng: m.lng });
      continue;
    }
    const n = group.length;
    const baseLat = group[0]!.lat;
    const baseLng = group[0]!.lng;
    const radius = 0.00011 * Math.min(3, 1 + (n - 2) * 0.15);

    group.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      out.set(m.id, {
        lat: baseLat + radius * Math.cos(angle),
        lng: baseLng + radius * Math.sin(angle) * 1.15,
      });
    });
  }

  return out;
}
