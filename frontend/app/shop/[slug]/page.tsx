"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QrCode, Sparkles } from "lucide-react";

import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { ShopProductShowcase } from "@/components/shop/shop-product-showcase";
import { ShopStorefrontHero } from "@/components/shop/shop-storefront-hero";
import { getShopProducts } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { saveLastShop } from "@/lib/personalization/client-hints";
import type { Product, ShopProfile } from "@/types";

export default function ShopPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const fromQr = searchParams.get("from") === "qr" || searchParams.get("qr") === "1";
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void getShopProducts(params.slug)
      .then((response) => {
        setShop(response.shop);
        setItems(response.items);
        saveLastShop({ slug: response.shop.slug, name: response.shop.name });
      })
      .catch(() => setError("Do'kon topilmadi yoki vaqtincha mavjud emas."))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const coverFromProduct = useMemo(() => {
    const first = items.find((p) => p.images?.[0]);
    return first?.images?.[0] ? resolveMediaUrl(first.images[0]) : null;
  }, [items]);

  return (
    <main className="shop-page min-h-dvh bg-canvas md:pb-6">
      <Navigation />
      <div className="page-content-top mx-auto max-w-6xl px-3 pb-10 sm:px-5 md:pb-10">
        {error ? (
          <div className="mt-6 rounded-2xl border border-red/20 bg-red/10 p-8 text-center text-red">{error}</div>
        ) : loading ? (
          <div className="mt-4 space-y-6">
            <div className="skeleton h-64 rounded-[1.75rem]" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          </div>
        ) : shop ? (
          <div className="mt-2 space-y-6 sm:mt-4">
            {fromQr ? (
              <div className="flex items-start gap-3 rounded-2xl border border-electric-500/20 bg-gradient-to-r from-electric-500/10 to-surface px-4 py-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-500 text-white">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-ink-900">Xush kelibsiz!</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-600">
                    Siz <strong>{shop.name}</strong> vitrinasidasiz — mahsulot tanlang yoki bron qiling.
                  </p>
                </div>
              </div>
            ) : null}

            <ShopStorefrontHero shop={shop} productCount={items.length} coverFromProduct={coverFromProduct} />

            {shop.is_featured ? (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-900">
                <Sparkles className="h-4 w-4 shrink-0" />
                Bu do&apos;kon Topdim tavsiyasi — mashhur sotuvchilar qatorida
              </div>
            ) : null}

            <ShopProductShowcase products={items} shopName={shop.name} />
          </div>
        ) : null}
      </div>
      <BottomNav />
    </main>
  );
}
