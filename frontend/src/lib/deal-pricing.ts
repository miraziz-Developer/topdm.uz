import { getGroupPrice, GROUP_DISCOUNT_RATE } from "@/lib/pricing";
import { productPriceUzs } from "@/lib/product-price";
import type { Product } from "@/types";

/** Faqat haqiqiy promo (attributes) yoki featured trend — har kartada -27% emas. */
export function productDiscountPercent(product: Product): number | null {
  const attrs = product.attributes ?? {};
  const promo = attrs.promo_percent ?? attrs.discount_percent;
  if (typeof promo === "number" && promo > 0 && promo < 90) return Math.round(promo);
  if (typeof promo === "string") {
    const n = Number.parseInt(promo, 10);
    if (n > 0 && n < 90) return n;
  }
  if (!product.is_featured) return null;
  const base = productPriceUzs(product);
  const group = getGroupPrice(base);
  if (base <= 0 || group >= base) return null;
  return Math.round(GROUP_DISCOUNT_RATE * 100);
}

export function formatSoldCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
  if (n > 0) return String(n);
  return "";
}
