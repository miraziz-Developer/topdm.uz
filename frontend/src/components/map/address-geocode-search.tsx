"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import {
  fetchAddressSuggestions,
  resolveAddressQuery,
  type AddressSuggestion,
} from "@/lib/map/yandex-geocoder-client";
import { cn } from "@/lib/utils";

type AddressGeocodeSearchProps = {
  value: string;
  onValueChange: (value: string) => void;
  selectedLabel: string | null;
  onResolved: (result: { lat: number; lng: number; label: string }) => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
};

export function AddressGeocodeSearch({
  value,
  onValueChange,
  selectedLabel,
  onResolved,
  onClear,
  disabled = false,
  className,
}: AddressGeocodeSearchProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadSuggestions = useCallback(async (text: string) => {
    const q = text.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = await fetchAddressSuggestions(q);
      setSuggestions(rows);
      setOpen(true);
      if (!rows.length) {
        setError("Hech narsa topilmadi. «Metro Chilonzor» yoki to‘liq manzil yozing.");
      }
    } catch {
      setSuggestions([]);
      setError("Qidiruv xatosi. Internetni tekshiring.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectedLabel && value === selectedLabel) return;
    debounceRef.current = setTimeout(() => {
      void loadSuggestions(value);
    }, 260);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, selectedLabel, loadSuggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pickSuggestion = async (item: AddressSuggestion) => {
    setOpen(false);
    setBusy(true);
    setError(null);
    onValueChange(item.query);
    try {
      if (item.lat != null && item.lng != null) {
        onResolved({
          lat: item.lat,
          lng: item.lng,
          label: item.query || item.title,
        });
        return;
      }
      const hit = await resolveAddressQuery(item.query);
      if (!hit) {
        setError("Joy topilmadi. Boshqa nom yozing (masalan: Metro Chilonzor).");
        return;
      }
      onResolved(hit);
    } catch {
      setError("Geocoder ishlamadi.");
    } finally {
      setBusy(false);
    }
  };

  const resolveTyped = async () => {
    const q = value.trim();
    if (q.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const hit = await resolveAddressQuery(q);
      if (!hit) {
        setError("Joy topilmadi. Ro‘yxatdan tanlang yoki aniqroq yozing.");
        return;
      }
      onResolved(hit);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative space-y-2", className)}>
      <p className="text-[11px] leading-snug text-ink-600">
        Yandex Maps kabi: «Metro Chilonzor», «Chorbog‘ ko‘chasi» — ro‘yxatdan tanlang.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          placeholder="Joy nomi (masalan: Metro Chilonzor)"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onValueChange(e.target.value);
            setError(null);
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void resolveTyped();
            }
          }}
          className="w-full rounded-lg border border-neutral-200/80 bg-white py-2 pl-8 pr-8 text-xs font-medium text-ink-800 outline-none focus:ring-2 focus:ring-electric-500/25 disabled:opacity-60"
        />
        {busy ? (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-electric-500" />
        ) : null}
      </div>

      {open && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 z-[200] mt-1 max-h-72 overflow-y-auto rounded-lg border border-neutral-200/80 bg-white py-1 shadow-xl">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void pickSuggestion(item)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-electric-500/8"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-electric-500" />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink-800">{item.title}</span>
                  {item.subtitle ? (
                    <span className="mt-0.5 block truncate text-[10px] text-ink-500">{item.subtitle}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedLabel ? (
        <p className="text-[10px] font-medium text-electric-700">
          Tanlandi: {selectedLabel}
          {onClear ? (
            <button type="button" onClick={onClear} className="ml-2 font-bold underline">
              Tozalash
            </button>
          ) : null}
        </p>
      ) : null}

      {error ? <p className="text-[10px] font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
