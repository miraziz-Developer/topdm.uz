import type { Product } from "@/types";

/** Canonical UZS amount for display math (API may send converted `price` + `price_uzs`). */
export function productPriceUzs(product: Pick<Product, "price" | "price_uzs">): number {
  if (product.price_uzs != null && Number.isFinite(product.price_uzs)) {
    return Number(product.price_uzs);
  }
  return Number(product.price) || 0;
}
