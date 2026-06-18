import { imagesForColor, type ProductSelectionOptions } from "@/lib/product-options";
import type { Product } from "@/types";

/** Savat / checkout — rang rasmi + asosiy galereya (buzilgan rang URL → galereya fallback). */
export function cartLineImages(
  product: Product,
  selectedOptions?: ProductSelectionOptions,
): string[] {
  return imagesForColor(product, selectedOptions?.color);
}
