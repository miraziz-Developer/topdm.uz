"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ProductImage } from "@/components/ui/product-image";
import {
  extractSelectableOptions,
  imagesForColor,
  isSelectionInStock,
  sizesForColor,
  type ProductSelectionOptions,
} from "@/lib/product-options";
import type { Product } from "@/types";

type ProductOptionModalProps = {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (options: ProductSelectionOptions) => void;
};

export function ProductOptionModal({ isOpen, product, onClose, onConfirm }: ProductOptionModalProps) {
  const { sizes: allSizes, colors } = useMemo(
    () => (product ? extractSelectableOptions(product) : { sizes: [], colors: [] }),
    [product],
  );
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const sizes = useMemo(
    () => (product ? sizesForColor(product, color) : allSizes),
    [product, color, allSizes],
  );

  useEffect(() => {
    if (!isOpen) return;
    const firstColor = colors[0] ?? "";
    setColor(firstColor);
    const allowed = product ? sizesForColor(product, firstColor) : allSizes;
    setSize(allowed[0] ?? allSizes[0] ?? "");
  }, [isOpen, colors, allSizes, product]);

  useEffect(() => {
    if (!product || !color) return;
    const allowed = sizesForColor(product, color);
    if (!allowed.length) return;
    setSize((prev) => (prev && allowed.includes(prev) ? prev : allowed[0] ?? ""));
  }, [color, product]);

  const inStock = product
    ? isSelectionInStock(product, { size: size || undefined, color: color || undefined })
    : true;
  const canConfirm =
    ((sizes.length === 0 || size) && (colors.length === 0 || color)) && inStock;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Variant tanlash">
      {product ? (
        <div className="space-y-4">
          <p className="text-sm text-text-300">{product.name}</p>
          {sizes.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-text-200">Razmer</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((item) => {
                  const available = product
                    ? isSelectionInStock(product, { color: color || undefined, size: item })
                    : true;
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={!available}
                      onClick={() => setSize(item)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        size === item ? "border-electric-500 bg-electric-500/10 text-electric-600" : "border-border-subtle"
                      } ${!available ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {colors.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-text-200">Rang</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((item) => {
                  const thumbImages = product ? imagesForColor(product, item) : [];
                  const colorSizes = product ? sizesForColor(product, item) : sizes;
                  const available = product
                    ? colorSizes.some((s) => isSelectionInStock(product, { color: item, size: s }))
                    : true;
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={!available}
                      onClick={() => setColor(item)}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                        color === item ? "border-electric-500 bg-electric-500/10 text-electric-600" : "border-border-subtle"
                      } ${!available ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {thumbImages.length ? (
                        <span className="relative h-8 w-8 overflow-hidden rounded-md">
                          <ProductImage images={thumbImages} alt="" fill className="object-cover" sizes="32px" />
                        </span>
                      ) : null}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Bekor
            </Button>
            <Button
              variant="brand"
              onClick={() => onConfirm({ size: size || undefined, color: color || undefined })}
              disabled={!canConfirm}
            >
              Davom etish
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
