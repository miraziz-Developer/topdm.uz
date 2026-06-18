"use client";

import Image from "next/image";
import { LayoutGrid } from "lucide-react";

import { shopSectionSubtitle, shopSectionTitle } from "@/components/shop/shop-premium-ui";

import { useCurrency } from "@/components/providers/currency-provider";
import { ShopFeaturedProduct } from "@/components/shop/shop-featured-product";
import { DiscoveryProductCard } from "@/components/ui/discovery-product-card";
import { ProductSkeleton } from "@/components/ui/product-skeleton";
import { isDemoProduct } from "@/lib/mock-shop-demo";
import { productImage } from "@/lib/media";
import type { Product } from "@/types";

type Props = {
  products: Product[];
  loading?: boolean;
  shopName?: string;
  shopSlug?: string;
  isDemo?: boolean;
};

export function ShopProductShowcase({ products, loading, shopName, shopSlug, isDemo }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border-subtle bg-surface px-6 py-16 text-center">
        <p className="font-semibold text-text-100">Hozircha mahsulot yo&apos;q</p>
        <p className="mt-1 text-sm text-text-400">
          {shopName ? `${shopName} tez orada yangi kolleksiya qo&apos;shadi` : "Keyinroq qaytib kiring"}
        </p>
      </div>
    );
  }

  const showFeatured = products.length === 1 && !isDemo && !isDemoProduct(products[0]!);

  return (
    <section id="shop-catalog" className="scroll-mt-24">
      {!showFeatured ? (
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0eeea] text-ink-700 ring-1 ring-black/[0.05]">
              <LayoutGrid className="h-5 w-5" />
            </span>
            <div>
              <h2 className={shopSectionTitle}>Katalog</h2>
              <p className={shopSectionSubtitle}>{products.length} ta mahsulot</p>
            </div>
          </div>
        </div>
      ) : null}

      {showFeatured && shopSlug ? (
        <ShopFeaturedProduct product={products[0]!} shopName={shopName ?? ""} shopSlug={shopSlug} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) =>
            isDemo || isDemoProduct(product) ? (
              <DemoProductTile key={product.id} product={product} />
            ) : (
              <div key={product.id} className="min-w-0">
                <DiscoveryProductCard product={product} index={index} priority={index < 8} uniformAspect />
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function DemoProductTile({ product }: { product: Product }) {
  const { formatPrice } = useCurrency();
  const img = productImage(product.images);

  return (
    <article className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
      <div className="relative aspect-[3/4] bg-canvas">
        <Image src={img} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" unoptimized />
        <span className="absolute left-2 top-2 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
          Demo
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-text-100">{product.name}</p>
        <p className="price-mono mt-1 text-base font-bold text-electric-600">
          {formatPrice(product.price_uzs ?? product.price)}
        </p>
      </div>
    </article>
  );
}
