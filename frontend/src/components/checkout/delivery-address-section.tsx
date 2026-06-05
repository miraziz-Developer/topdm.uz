"use client";

import { MapPin } from "lucide-react";

import { AddressGeocodeSearch } from "@/components/map/address-geocode-search";
import { Input } from "@/components/ui/input";
import { buildYandexMapsPointUrl } from "@/lib/map/yandex-external";

type DeliveryAddressSectionProps = {
  query: string;
  onQueryChange: (value: string) => void;
  resolvedLabel: string | null;
  lat: number | null;
  lng: number | null;
  onResolved: (result: { lat: number; lng: number; label: string }) => void;
  onClearResolved: () => void;
  apartment: string;
  onApartmentChange: (value: string) => void;
  entrance: string;
  onEntranceChange: (value: string) => void;
  floor: string;
  onFloorChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
};

export function DeliveryAddressSection({
  query,
  onQueryChange,
  resolvedLabel,
  lat,
  lng,
  onResolved,
  onClearResolved,
  apartment,
  onApartmentChange,
  entrance,
  onEntranceChange,
  floor,
  onFloorChange,
  city,
  onCityChange,
}: DeliveryAddressSectionProps) {
  const hasPoint = lat != null && lng != null;
  const mapUrl = hasPoint ? buildYandexMapsPointUrl({ lat, lng }, 16) : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">Yetkazish manzili</h3>
        <p className="mt-0.5 text-xs text-ink-500">
          Avval xaritadan joy tanlang, keyin kvartira / eshik / qavatni yozing — ikkalasi birlashtiriladi.
        </p>
      </div>

      <AddressGeocodeSearch
        value={query}
        onValueChange={onQueryChange}
        selectedLabel={resolvedLabel}
        onResolved={onResolved}
        onClear={onClearResolved}
      />

      <Input label="Shahar" value={city} onChange={(e) => onCityChange(e.target.value)} placeholder="Toshkent" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Uy / kvartira"
          value={apartment}
          onChange={(e) => onApartmentChange(e.target.value)}
          placeholder="12-uy, 45-kv"
        />
        <Input
          label="Pod&apos;ezd"
          value={entrance}
          onChange={(e) => onEntranceChange(e.target.value)}
          placeholder="2"
        />
        <Input label="Qavat" value={floor} onChange={(e) => onFloorChange(e.target.value)} placeholder="5" />
      </div>

      {hasPoint && mapUrl ? (
        <div className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50/50">
          <div className="flex items-center justify-between gap-2 border-b border-orange-200/80 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-800">
              <MapPin className="h-3.5 w-3.5" />
              Xaritada tasdiqlangan joy
            </p>
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-electric-600 hover:underline"
            >
              Yandex xaritada ochish
            </a>
          </div>
          <p className="px-3 py-2 text-xs text-ink-700">{resolvedLabel || query}</p>
          <p className="px-3 pb-2 font-mono text-[10px] text-ink-500">
            {lat?.toFixed(5)}, {lng?.toFixed(5)}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Manzilni ro‘yxatdan tanlang — shundan keyin yetkazish narxi hisoblanadi.
        </p>
      )}
    </div>
  );
}

export function buildFullDeliveryAddress(parts: {
  resolvedLabel: string | null;
  query: string;
  city: string;
  apartment: string;
  entrance: string;
  floor: string;
}): string {
  const base = (parts.resolvedLabel || parts.query).trim();
  const extras = [
    parts.city.trim() ? `Shahar: ${parts.city.trim()}` : "",
    parts.apartment.trim() ? `Uy/kv: ${parts.apartment.trim()}` : "",
    parts.entrance.trim() ? `Pod'ezd: ${parts.entrance.trim()}` : "",
    parts.floor.trim() ? `Qavat: ${parts.floor.trim()}` : "",
  ].filter(Boolean);
  if (!extras.length) return base;
  return `${base}. ${extras.join(", ")}`;
}
