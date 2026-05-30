import type { PurchaseMode } from "@/stores/cart-store";

export function cartLineKey(productId: string, mode: PurchaseMode, optionKey = "") {
  return `${productId}:${mode}:${optionKey}`;
}
