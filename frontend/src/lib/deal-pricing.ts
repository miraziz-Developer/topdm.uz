import type { Product } from "@/types";

/** Faqat haqiqiy promo (attributes) — guruh chegirmasi ko'rsatilmaydi. */
export function productDiscountPercent(product: Product): number | null {
  const attrs = product.attributes ?? {};
  const promo = attrs.promo_percent ?? attrs.discount_percent;
  if (typeof promo === "number" && promo > 0 && promo < 90) return Math.round(promo);
  if (typeof promo === "string") {
    const n = Number.parseInt(promo, 10);
    if (n > 0 && n < 90) return n;
  }
  return null;
}

export function formatSoldCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
  if (n > 0) return String(n);
  return "";
}
