"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Clock, Boxes } from "lucide-react";

import { MarketShell } from "@/components/market/MarketShell";
import { PremiumActionButtons } from "@/components/market/PremiumActionButtons";
import { PremiumChipSelector } from "@/components/market/PremiumChipSelector";
import { PremiumImageGallery } from "@/components/market/PremiumImageGallery";
import { PremiumPriceCard } from "@/components/market/PremiumPriceCard";
import { marketPanel } from "@/components/market/market-ui";
import { fetchLocalProduct, type LocalProduct } from "@/lib/premium-market";
import { useToast } from "@/components/ui/toast";

type Props = {
  itemId: string;
};

function sizesForColor(item: LocalProduct, color: string): string[] {
  if (!color) return item.sizes;
  const direct = item.size_matrix[color];
  if (direct?.length) return direct;
  const norm = color.trim().toLowerCase();
  for (const [key, sizes] of Object.entries(item.size_matrix)) {
    if (key.trim().toLowerCase() === norm) return sizes;
  }
  return item.sizes;
}

export function LocalProductPage({ itemId }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [item, setItem] = useState<LocalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLocalProduct(itemId)
      .then((res) => {
        if (cancelled) return;
        setItem(res.item);
        const c = res.item.colors[0] ?? "";
        setColor(c);
        setSize(sizesForColor(res.item, c)[0] ?? res.item.sizes[0] ?? "");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const allowedSizes = useMemo(() => (item ? sizesForColor(item, color) : []), [item, color]);

  useEffect(() => {
    if (!allowedSizes.length) return;
    setSize((prev) => (prev && allowedSizes.includes(prev) ? prev : allowedSizes[0]));
  }, [allowedSizes]);

  const shellTitle = loading ? "Yuklanmoqda…" : item?.name ?? "Mahalliy tovar";

  return (
    <MarketShell
      title={shellTitle}
      subtitle="Mahalliy do'kon — ombor, kuryer va yakuniy narx"
      backHref="/market/local"
      backLabel="Ichki bozorga"
    >
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : error || !item ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center text-red-300">
          {error ?? "Tovar topilmadi"}
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          <PremiumImageGallery images={item.images} alt={item.name} />
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/80">Ichki bozor</p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{item.name}</h2>
              {item.description ? <p className="mt-3 text-sm text-white/55">{item.description}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`${marketPanel} !p-3`}>
                <Boxes className="h-4 w-4 text-emerald-400" />
                <p className="mt-2 text-xs text-white/45">Omborda</p>
                <p className="text-lg font-bold text-white">{item.stock_count} dona</p>
              </div>
              <div className={`${marketPanel} !p-3`}>
                <Clock className="h-4 w-4 text-cyan-400" />
                <p className="mt-2 text-xs text-white/45">Yetkazish</p>
                <p className="text-sm font-semibold text-white">{item.courier_eta_label}</p>
              </div>
              <div className={`${marketPanel} !p-3`}>
                <MapPin className="h-4 w-4 text-emerald-400" />
                <p className="mt-2 text-xs text-white/45">{item.shop.name}</p>
                <p className="text-xs text-white/60">
                  {[item.shop.floor, item.shop.stall, item.shop.location_label].filter(Boolean).join(" · ") ||
                    "Toshkent bozori"}
                </p>
              </div>
            </div>

            {item.colors.length || item.sizes.length ? (
              <div className={`${marketPanel} space-y-4`}>
                <PremiumChipSelector label="Rang" options={item.colors} value={color} onChange={setColor} />
                <PremiumChipSelector label="Razmer" options={allowedSizes} value={size} onChange={setSize} />
              </div>
            ) : null}

            <PremiumPriceCard
              mode="local"
              pricing={item.pricing}
              productAmount={item.product_price_uzs}
              cargoLabel="Toshkent ichida kuryer"
            />

            <PremiumActionButtons
              disabled={!item.is_available}
              onBuy={() => router.push(`/product/${item.item_id}`)}
              onCart={() => {
                router.push(`/product/${item.item_id}`);
                push("Mahsulot sahifasida variant tanlang", "info");
              }}
            />
          </div>
        </div>
      )}
    </MarketShell>
  );
}
