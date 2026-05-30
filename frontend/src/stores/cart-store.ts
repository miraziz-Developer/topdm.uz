"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getGroupPrice } from "@/lib/pricing";
import { cartLineKey } from "@/lib/cart-line";
import { selectionKey, type ProductSelectionOptions } from "@/lib/product-options";
import type { Product } from "@/types";

export type PurchaseMode = "single" | "group";

export type CartLine = {
  product: Product;
  quantity: number;
  mode: PurchaseMode;
  selectedOptions?: ProductSelectionOptions;
};

type CartState = {
  lines: CartLine[];
  lastAdded: Product | null;
  addItem: (product: Product, quantity?: number, mode?: PurchaseMode, selectedOptions?: ProductSelectionOptions) => void;
  removeItem: (productId: string, mode?: PurchaseMode, selectedOptions?: ProductSelectionOptions) => void;
  setQuantity: (productId: string, quantity: number, mode?: PurchaseMode, selectedOptions?: ProductSelectionOptions) => void;
  clear: () => void;
  clearLastAdded: () => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      lastAdded: null,
      addItem: (product, quantity = 1, mode = "single", selectedOptions) => {
        set((state) => {
          const existing = state.lines.find(
            (line) =>
              line.product.id === product.id &&
              line.mode === mode &&
              selectionKey(line.selectedOptions) === selectionKey(selectedOptions),
          );
          if (existing) {
            return {
              lastAdded: product,
              lines: state.lines.map((line) =>
                line.product.id === product.id &&
                line.mode === mode &&
                selectionKey(line.selectedOptions) === selectionKey(selectedOptions)
                  ? { ...line, quantity: Math.min(99, line.quantity + quantity) }
                  : line,
              ),
            };
          }
          return {
            lastAdded: product,
            lines: [...state.lines, { product, quantity, mode, selectedOptions }],
          };
        });
      },
      removeItem: (productId, mode, selectedOptions) => {
        set((state) => ({
          lines: state.lines.filter((line) =>
            mode
              ? cartLineKey(line.product.id, line.mode, selectionKey(line.selectedOptions)) !==
                cartLineKey(productId, mode, selectionKey(selectedOptions))
              : line.product.id !== productId,
          ),
        }));
      },
      setQuantity: (productId, quantity, mode, selectedOptions) => {
        if (quantity < 1) {
          get().removeItem(productId, mode, selectedOptions);
          return;
        }
        set((state) => ({
          lines: state.lines.map((line) =>
            line.product.id === productId &&
            (!mode || line.mode === mode) &&
            (!selectedOptions || selectionKey(line.selectedOptions) === selectionKey(selectedOptions))
              ? { ...line, quantity: Math.min(99, quantity) }
              : line,
          ),
        }));
      },
      clear: () => set({ lines: [], lastAdded: null }),
      clearLastAdded: () => set({ lastAdded: null }),
      totalItems: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
      totalPrice: () =>
        get().lines.reduce((sum, line) => {
          const unit = line.mode === "group" ? getGroupPrice(line.product.price) : line.product.price;
          return sum + unit * line.quantity;
        }, 0),
    }),
    { name: "bozor-cart" },
  ),
);
