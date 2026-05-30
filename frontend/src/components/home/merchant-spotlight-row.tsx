"use client";

import { StoreCard } from "@/components/store/StoreCard";
import { SectionHeader } from "@/components/ui/section-header";
import { useT } from "@/i18n/locale-provider";
import type { Product, ShopSummary } from "@/types";

export type MerchantSpotlightRowProps = {
  shops: ShopSummary[];
  products: Product[];
  loading?: boolean;
};

export function MerchantSpotlightRow({ shops, products, loading }: MerchantSpotlightRowProps) {
  const t = useT();
  const shopsWithCatalog = shops
    .map((shop) => ({
      shop,
      topProducts: products.filter((p) => p.shop?.id === shop.id).slice(0, 3),
    }))
    .filter((entry) => entry.topProducts.length > 0);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6" aria-busy="true">
        <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-elevated" />
        <div className="mt-6 flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 w-[min(100%,280px)] shrink-0 animate-pulse rounded-2xl bg-elevated sm:w-[280px]" />
          ))}
        </div>
      </section>
    );
  }

  if (!shopsWithCatalog.length) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <SectionHeader
        eyebrow={t("home.merchant.eyebrow")}
        title={t("home.merchant.title")}
        description={t("home.merchant.description")}
      />
      <div className="scrollbar-hide scroll-x-contained -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {shopsWithCatalog.map(({ shop, topProducts }) => {
          const href = shop.slug ? `/shop/${shop.slug}` : "/search";
          const shopWithRating: ShopSummary = {
            ...shop,
            rating: shop.rating ?? undefined,
            review_count: shop.review_count ?? 0,
          };
          return <StoreCard key={shop.id} shop={shopWithRating} topProducts={topProducts} href={href} />;
        })}
      </div>
    </section>
  );
}
