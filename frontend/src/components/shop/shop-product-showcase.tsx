"use client";

import Image from "next/image";
import { useCurrency } from "@/components/providers/currency-provider";
import { DiscoveryProductCard } from "@/components/ui/discovery-product-card";
import { ProductSkeleton } from "@/components/ui/product-skeleton";
import { isDemoProduct } from "@/lib/mock-shop-demo";
import { productImage } from "@/lib/media";
import type { Product } from "@/types";

type Props = {
  products: Product[];
  loading?: boolean;
  shopName?: string;
  isDemo?: boolean;
};

export function ShopProductShowcase({ products, loading, shopName, isDemo }: Props) {
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
