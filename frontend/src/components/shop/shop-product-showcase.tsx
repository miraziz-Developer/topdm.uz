"use client";

import { DiscoveryProductCard } from "@/components/ui/discovery-product-card";
import { ProductSkeleton } from "@/components/ui/product-skeleton";
import type { Product } from "@/types";

type Props = {
  products: Product[];
  loading?: boolean;
  shopName?: string;
};

export function ShopProductShowcase({ products, loading, shopName }: Props) {
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
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-16 text-center">
        <p className="font-semibold text-text-100">Hozircha mahsulot yo&apos;q</p>
        <p className="mt-1 text-sm text-text-400">
          {shopName ? `${shopName} tez orada yangi kolleksiya qo&apos;shadi` : "Keyinroq qaytib kiring"}
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text-100">Katalog</h2>
          <p className="text-sm text-text-400">{products.length} ta mahsulot</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product, index) => (
          <div key={product.id} className="min-w-0">
            <DiscoveryProductCard product={product} index={index} priority={index < 8} uniformAspect />
          </div>
        ))}
      </div>
    </section>
  );
}
