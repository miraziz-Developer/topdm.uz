"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Package } from "lucide-react";

import { PremiumActionButtons } from "@/components/market/PremiumActionButtons";
import { PremiumChipSelector } from "@/components/market/PremiumChipSelector";
import { PremiumImageGallery } from "@/components/market/PremiumImageGallery";
import { PremiumPriceCard } from "@/components/market/PremiumPriceCard";
import { marketEyebrow, marketPanel } from "@/components/market/market-ui";
import { fetchChinaProduct, formatUzs, type ChinaProduct } from "@/lib/premium-market";
import { isChinaMarketEnabled } from "@/lib/runtime-flags";
import { useToast } from "@/components/ui/toast";

type Props = {
  itemId: string;
};

export function ChinaProductDetailPage({ itemId }: Props) {
  const { push } = useToast();
  const chinaEnabled = isChinaMarketEnabled();
  const [item, setItem] = useState<ChinaProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchChinaProduct(itemId)
      .then((res) => {
        if (cancelled) return;
        setItem(res.item);
        setColor(res.item.colors[0] ?? "");
        setSize(res.item.sizes[0] ?? "");
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

  const sizesForColor = useMemo(() => {
    if (!item) return [];
    if (!color) return item.sizes;
    const fromSkus = item.skus
      .filter((s) => (s.color ?? "").toLowerCase() === color.toLowerCase() && s.size)
      .map((s) => s.size as string);
    return fromSkus.length ? [...new Set(fromSkus)] : item.sizes;
  }, [item, color]);

  useEffect(() => {
    if (!sizesForColor.length) return;
    setSize((prev) => (prev && sizesForColor.includes(prev) ? prev : sizesForColor[0]));
  }, [sizesForColor]);

  const gallery = useMemo(() => {
    if (!item) return [];
    const skuImg = item.skus.find(
      (s) =>
        (s.color ?? "").toLowerCase() === color.toLowerCase() &&
        (s.size ?? "").toLowerCase() === size.toLowerCase() &&
        s.image_url,
    )?.image_url;
    if (skuImg) return [skuImg, ...item.images.filter((u) => u !== skuImg)];
    return item.images;
  }, [item, color, size]);

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6">
        <Link
          href="/market/china"
          className="inline-flex items-center gap-2 text-sm text-text-400 transition-colors hover:text-electric-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Qidiruvga qaytish
        </Link>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-9 w-9 animate-spin text-electric-500" />
          </div>
        ) : error || !item ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center text-red-700">
            {error ?? "Tovar topilmadi"}
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
            <PremiumImageGallery images={gallery} alt={item.title} />
            <div className="space-y-6">
              <div>
                <p className={marketEyebrow}>Xitoy · Taobao</p>
                <h1 className="mt-2 text-2xl font-bold leading-tight text-ink-900 sm:text-3xl">{item.title}</h1>
                {item.description ? <p className="mt-3 text-sm text-text-400">{item.description}</p> : null}
              </div>

              <div className={`${marketPanel} space-y-4`}>
                <PremiumChipSelector label="Rang" options={item.colors} value={color} onChange={setColor} />
                <PremiumChipSelector
                  label="O'lcham / Razmer"
                  options={sizesForColor}
                  value={size}
                  onChange={setSize}
                />
              </div>

              <PremiumPriceCard mode="china" pricing={item.pricing} />

              <p className="text-center text-2xl font-black text-electric-500">
                {formatUzs(item.pricing.total_price_uzs)}
              </p>

              <PremiumActionButtons
                disabled={!chinaEnabled || (!color && item.colors.length > 0)}
                onBuy={() => {
                  if (!chinaEnabled) {
                    push("Xitoy bozori hozircha yoqilmagan", "info");
                    return;
                  }
                  push("Import buyurtma tez orada — hozir Taobao manbasiga o'ting", "info");
                }}
                onCart={() => {
                  if (!chinaEnabled) {
                    push("Xitoy bozori hozircha yoqilmagan", "info");
                    return;
                  }
                  push("Mahalliy savat faqat do'kon mahsulotlari uchun", "error");
                }}
              />

              {item.source_url ? (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-text-400 hover:text-electric-500"
                >
                  <Package className="h-3.5 w-3.5" />
                  Taobao manbasi
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
