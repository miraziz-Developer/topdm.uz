import type { Product } from "@/types";

/** stock_count=0 odatda "kuzatilmaydi" — "Kam qoldi" faqat 1–10 dona qolganda. */
export function isLowStock(product: Pick<Product, "stock_count">): boolean {
  const n = product.stock_count;
  if (n == null || n === undefined) return false;
  return n >= 1 && n <= 10;
}
