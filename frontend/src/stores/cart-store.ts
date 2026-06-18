"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { clampCartQuantity, defaultCartQuantity } from "@/lib/wholesale";
import { cartLineKey } from "@/lib/cart-line";
import { selectionKey, type ProductSelectionOptions } from "@/lib/product-options";
import type { Product } from "@/types";

/** "group" — eski versiya merosi; narxga ta'sir qilmaydi (har doim haqiqiy narx). */
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
      addItem: (product, quantity, mode = "single", selectedOptions) => {
        if (String(product.id).startsWith("china:")) {
          return;
        }
        const qty = clampCartQuantity(product, quantity ?? defaultCartQuantity(product));
        // Narx har doim haqiqiy chakana/optom narx — "group" rejimi bekor qilingan.
        const effectiveMode: PurchaseMode = mode === "group" ? "single" : mode;
        set((state) => {
          const existing = state.lines.find(
            (line) =>
              line.product.id === product.id &&
              line.mode === effectiveMode &&
              selectionKey(line.selectedOptions) === selectionKey(selectedOptions),
          );
          if (existing) {
            return {
              lastAdded: product,
              lines: state.lines.map((line) =>
                line.product.id === product.id &&
                line.mode === effectiveMode &&
                selectionKey(line.selectedOptions) === selectionKey(selectedOptions)
                  ? {
                      ...line,
                      quantity: clampCartQuantity(product, line.quantity + qty),
                    }
                  : line,
              ),
            };
          }
          return {
            lastAdded: product,
            lines: [...state.lines, { product, quantity: qty, mode: effectiveMode, selectedOptions }],
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
        const line = get().lines.find(
          (l) =>
            l.product.id === productId &&
            (!mode || l.mode === mode) &&
            (!selectedOptions || selectionKey(l.selectedOptions) === selectionKey(selectedOptions)),
        );
        const nextQty = line?.product ? clampCartQuantity(line.product, quantity) : quantity;
        if (nextQty < 1) {
          get().removeItem(productId, mode, selectedOptions);
          return;
        }
        set((state) => ({
          lines: state.lines.map((line) =>
            line.product.id === productId &&
            (!mode || line.mode === mode) &&
            (!selectedOptions || selectionKey(line.selectedOptions) === selectionKey(selectedOptions))
              ? { ...line, quantity: nextQty }
              : line,
          ),
        }));
      },
      clear: () => set({ lines: [], lastAdded: null }),
      clearLastAdded: () => set({ lastAdded: null }),
      totalItems: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
      totalPrice: () =>
        get().lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    }),
    {
      name: "bozor-cart",
      version: 2,
      migrate: (persisted: unknown) => {
        const state = persisted as { lines?: CartLine[] } | undefined;
        if (state?.lines) {
          state.lines = state.lines.map((line) => ({ ...line, mode: "single" as PurchaseMode }));
        }
        return state as never;
      },
    },
  ),
);
