"use client";

import { DiscoveryProductGrid } from "@/components/ui/discovery-product-grid";
import type { Product } from "@/types";

type MasonryProductGridProps = {
  products: Product[];
  loading?: boolean;
  onBand?: (product: Product) => void;
  bulkMode?: boolean;
};

/** Home feed — stylist discovery masonry columns. */
export function MasonryProductGrid({ products, loading, onBand, bulkMode }: MasonryProductGridProps) {
  return <DiscoveryProductGrid products={products} loading={loading} onBand={onBand} bulkMode={bulkMode} />;
}
