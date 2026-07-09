"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Store, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { getShops, type ShopItem } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export function ShopPicker({
  value,
  onChange,
}: {
  value: ShopItem | null;
  onChange: (shop: ShopItem | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["shop-picker", debounced],
    queryFn: () => getShops({ q: debounced || undefined }),
    enabled: open,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const items = data?.items ?? [];

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-input bg-secondary/40 px-3 py-2">
          <Store className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="truncate text-xs text-muted-foreground">{value.owner_phone ?? value.id.slice(0, 8)}</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Do'kon nomi yoki telefon bo'yicha qidiring..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
      )}

      {open && !value ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Qidirilmoqda...</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Do&apos;kon topilmadi</p>
          ) : (
            items.map((shop) => (
              <button
                key={shop.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60",
                )}
                onClick={() => {
                  onChange(shop);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{shop.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {shop.ipadrom_name ?? shop.market_zone ?? "—"} · {shop.owner_phone ?? "—"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
