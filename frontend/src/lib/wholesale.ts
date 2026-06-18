import { productPriceUzs } from "@/lib/product-price";
import type { Product } from "@/types";

export type PackCompositionRow = { size: string; qty: number };

export function isPackProduct(product: Product): boolean {
  return product.sale_type === "Optom" && (product.pricing_unit === "pack" || product.price_is_pack === true);
}

export function isOptomProduct(product: Product): boolean {
  return product.sale_type === "Optom";
}

export function minOrderQuantity(product: Product): number {
  return Math.max(1, Number(product.min_order_quantity) || 1);
}

export function defaultCartQuantity(product: Product): number {
  return minOrderQuantity(product);
}

export function quantityStep(product: Product): number {
  return isPackProduct(product) ? 1 : 1;
}

export function packLabel(product: Product): string | null {
  if (!isPackProduct(product)) return null;
  if (product.pack_label) return product.pack_label;
  const upp = product.units_per_pack;
  if (upp) return `${upp} dona/pachka`;
  return "pachka";
}

export function priceLabel(product: Product): string {
  if (isPackProduct(product)) return "1 pachka narxi";
  return "Narx";
}

export function quantityUnitLabel(product: Product): string {
  return isPackProduct(product) ? "pachka" : "dona";
}

export function formatPackComposition(product: Product): string | null {
  const rows = product.pack_composition;
  if (!rows?.length) return null;
  return rows.map((r) => `${r.qty}×${r.size}`).join(", ");
}

export function clampCartQuantity(product: Product, qty: number): number {
  const min = minOrderQuantity(product);
  return Math.min(99, Math.max(min, Math.floor(qty)));
}

/** Pachka narxidan bitta dona narxi (optom). */
export function perPieceFromPack(product: Product, packPriceUzs?: number): number | null {
  const upp = product.units_per_pack;
  if (!upp || upp < 2) return null;
  if (!isOptomProduct(product)) return null;
  const pack = packPriceUzs ?? productPriceUzs(product);
  if (pack <= 0) return null;
  return Math.round(pack / upp);
}

/** Katalog kartalari uchun qisqa optom/pachka izohi (Guruh emas). */
export function optomCardHint(product: Product, formatPrice: (amount: number) => string): string | null {
  if (!isOptomProduct(product)) return null;

  const packPrice = productPriceUzs(product);
  const perPiece = perPieceFromPack(product, packPrice);
  const label = packLabel(product);

  if (isPackProduct(product) && perPiece && label) {
    return `Pachka olsangiz — donadan ${formatPrice(perPiece)}`;
  }
  if (label) return `Optom · ${label}`;
  const moq = minOrderQuantity(product);
  if (moq > 1) return `Optom · min ${moq} ${quantityUnitLabel(product)}`;
  return "Optom narx";
}

/** Asosiy narx yonidagi birlik: dona yoki pachka. */
export function priceUnitSuffix(product: Product): string | null {
  if (isPackProduct(product)) return "/pachka";
  if (product.sale_type === "Optom") return "/dona";
  return null;
}
