"use client";

import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getMarketGeofenceBoundary } from "@/lib/api";
import { IPPODROM_CENTER } from "@/lib/map/market-geo";
import { isYandexMapsApiEnabled, loadYandexMaps, resolveYandexMapsApiKey } from "@/lib/map/yandex-maps-loader";
import { cn } from "@/lib/utils";

type Props = {
  marketSlug?: string;
  shopName: string;
  position: { lat: number; lng: number } | null;
  onPositionChange: (lat: number, lng: number) => void;
  className?: string;
};

export function MerchantShopYandexMap({
  marketSlug = "ippodrom",
  shopName,
  position,
  onPositionChange,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const placemarkRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isYandexMapsApiEnabled() || !hostRef.current) {
      setError("Yandex xarita kaliti sozlanmagan (NEXT_PUBLIC_YANDEX_MAPS_API_KEY)");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const apiKey = resolveYandexMapsApiKey();

    (async () => {
      try {
        const [ymapsRaw, boundary] = await Promise.all([
          loadYandexMaps(apiKey),
          getMarketGeofenceBoundary(marketSlug),
        ]);
        const ymaps: any = ymapsRaw;
        if (cancelled || !hostRef.current) return;

        const polygon = boundary.geofence?.polygon ?? [];
        const center = boundary.geofence?.center;
        const start = position ?? {
          lat: Number(center?.lat ?? IPPODROM_CENTER.lat),
          lng: Number(center?.lng ?? IPPODROM_CENTER.lng),
        };

        const map = new ymaps.Map(
          hostRef.current,
          {
            center: [start.lat, start.lng],
            zoom: 17,
            controls: ["zoomControl", "geolocationControl"],
          },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;

        if (polygon.length >= 3) {
          const ring = polygon.map((p) => [p.lat, p.lng] as [number, number]);
          const geo = new ymaps.Polygon(
            [ring],
            {},
            {
              fillColor: "0066ff18",
              strokeColor: "#0066ff",
              strokeWidth: 2,
              strokeOpacity: 0.7,
            },
          );
          map.geoObjects.add(geo);
        }

        const placemark = new ymaps.Placemark(
          [start.lat, start.lng],
          {
            balloonContentHeader: shopName,
            balloonContentBody: "Do'koningiz — pinni sudrab aniq joylashtiring",
          },
          { preset: "islands#blueShoppingIcon", draggable: true },
        );
        placemarkRef.current = placemark;
        map.geoObjects.add(placemark);

        placemark.events.add("dragend", () => {
          const coords = (placemark as { geometry: { getCoordinates: () => number[] } }).geometry.getCoordinates();
          if (coords?.length >= 2) onPositionChange(coords[0], coords[1]);
        });

        map.events.add("click", (e: any) => {
          const coords = e?.get?.("coords") as number[] | undefined;
          if (!Array.isArray(coords) || coords.length < 2) return;
          (placemark as { geometry: { setCoordinates: (c: number[]) => void } }).geometry.setCoordinates(coords);
          onPositionChange(coords[0], coords[1]);
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Xarita yuklanmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      placemarkRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; position updates below
  }, [marketSlug, shopName]);

  useEffect(() => {
    if (!position || !placemarkRef.current) return;
    const pm = placemarkRef.current as { geometry: { setCoordinates: (c: number[]) => void } };
    pm.geometry.setCoordinates([position.lat, position.lng]);
    const map = mapRef.current as { setCenter?: (c: number[], zoom?: number) => void } | null;
    map?.setCenter?.([position.lat, position.lng]);
  }, [position?.lat, position?.lng]);

  if (error) {
    return (
      <div className={cn("rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center", className)}>
        <MapPin className="mx-auto h-8 w-8 text-amber-700" />
        <p className="mt-2 text-sm font-medium text-text-100">{error}</p>
        <p className="mt-1 text-xs text-text-400">CRM uchun Yandex Maps API kalitini .env ga qo&apos;ying</p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border-subtle ring-1 ring-border-subtle", className)}>
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/80">
          <Loader2 className="h-8 w-8 animate-spin text-electric-500" />
        </div>
      ) : null}
      <div ref={hostRef} className="h-[min(52vh,420px)] w-full bg-canvas" />
      <p className="border-t border-border-subtle bg-canvas/80 px-3 py-2 text-center text-[11px] text-text-400">
        Pinni sudrang yoki xaritada bosing — haqiqiy joylashuv shu yerda saqlanadi
      </p>
    </div>
  );
}
