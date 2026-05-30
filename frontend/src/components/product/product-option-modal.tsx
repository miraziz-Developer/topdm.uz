"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { extractSelectableOptions, sizesForColor, type ProductSelectionOptions } from "@/lib/product-options";
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

  const canConfirm = (sizes.length === 0 || size) && (colors.length === 0 || color);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Variant tanlash">
      {product ? (
        <div className="space-y-4">
          <p className="text-sm text-text-300">{product.name}</p>
          {sizes.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-text-200">Razmer</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSize(item)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      size === item ? "border-electric-500 bg-electric-500/10 text-electric-600" : "border-border-subtle"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {colors.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-text-200">Rang</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setColor(item)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      color === item ? "border-electric-500 bg-electric-500/10 text-electric-600" : "border-border-subtle"
                    }`}
                  >
                    {item}
                  </button>
                ))}
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
