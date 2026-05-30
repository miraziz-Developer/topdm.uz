"use client";

import { DiscoveryProductCard } from "@/components/ui/discovery-product-card";
import { ProductSkeleton } from "@/components/ui/product-skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

const MASONRY_COLUMNS =
  "columns-2 gap-x-4 md:columns-3 md:gap-x-5 lg:columns-4 xl:columns-5";

type DiscoveryProductGridProps = {
  products: Product[];
  loading?: boolean;
  onBand?: (product: Product) => void;
  bulkMode?: boolean;
};

export function DiscoveryProductGrid({ products, loading, onBand, bulkMode }: DiscoveryProductGridProps) {
  if (loading) {
    return (
      <div className={cn(MASONRY_COLUMNS)}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`sk-${i}`} className="mb-4 break-inside-avoid md:mb-5">
            <ProductSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) return null;

  return (
    <div className={cn(MASONRY_COLUMNS)}>
      {products.map((product, index) => (
        <div key={product.id} className="mb-4 break-inside-avoid md:mb-5">
          <DiscoveryProductCard
            product={product}
            index={index}
            priority={index < 6}
            onBand={onBand}
            bulkMode={bulkMode}
          />
        </div>
      ))}
    </div>
  );
}
