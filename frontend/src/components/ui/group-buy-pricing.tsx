"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";

import { ProductOptionModal } from "@/components/product/product-option-modal";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/lib/haptics";
import { productImage } from "@/lib/media";
import { extractSelectableOptions, type ProductSelectionOptions } from "@/lib/product-options";
import { useCartStore } from "@/stores/cart-store";
import { useFlyToCartStore } from "@/stores/fly-to-cart-store";
import type { Product } from "@/types";

type GroupBuyPricingProps = {
  product: Product;
  onReserve?: () => void;
  preferredOptions?: ProductSelectionOptions;
  forceInlineSelection?: boolean;
  onRequireSelection?: () => void;
};

export function GroupBuyPricing({
  product,
  onReserve,
  preferredOptions,
  forceInlineSelection = false,
  onRequireSelection,
}: GroupBuyPricingProps) {
  const { formatPrice } = useCurrency();
  const addItem = useCartStore((state) => state.addItem);
  const launch = useFlyToCartStore((state) => state.launch);
  const [optionOpen, setOptionOpen] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);

  const addToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic();
    const rect = event.currentTarget.getBoundingClientRect();
    const opts = extractSelectableOptions(product);
    const inlineMissing =
      forceInlineSelection &&
      ((opts.sizes.length > 0 && !preferredOptions?.size) || (opts.colors.length > 0 && !preferredOptions?.color));
    if (inlineMissing) {
      onRequireSelection?.();
      return;
    }
    const resolvedOptions = preferredOptions;
    if (opts.sizes.length || opts.colors.length) {
      if (forceInlineSelection) {
        launch({
          image: productImage(product.images),
          x: rect.left,
          y: rect.top,
        });
        addItem(product, 1, "single", resolvedOptions);
        onReserve?.();
        return;
      }
      setPendingPoint({ x: rect.left, y: rect.top });
      setOptionOpen(true);
      return;
    }
    launch({
      image: productImage(product.images),
      x: rect.left,
      y: rect.top,
    });
    addItem(product, 1, "single", resolvedOptions);
    onReserve?.();
  };

  const confirmOptions = (selectedOptions: ProductSelectionOptions) => {
    if (pendingPoint) {
      launch({
        image: productImage(product.images),
        x: pendingPoint.x,
        y: pendingPoint.y,
      });
    }
    addItem(product, 1, "single", selectedOptions);
    onReserve?.();
    setOptionOpen(false);
    setPendingPoint(null);
  };

  return (
    <>
    <div className="rounded-2xl border border-border-subtle bg-white p-4 shadow-sm">
      <p className="text-xs text-ink-500">Narx</p>
      <p className="price-mono mt-0.5 text-2xl font-bold text-ink-900">{formatPrice(product.price)}</p>
      <p className="mt-1 text-[11px] text-ink-400">Savatchaga qo&apos;shib davom eting</p>
      <div className="mt-3">
        <Button className="w-full whitespace-nowrap font-semibold" size="md" variant="brand" onClick={addToCart} leftIcon={<ShoppingBag className="h-4 w-4" />}>
          Sotib olish
        </Button>
      </div>
    </div>
    <ProductOptionModal isOpen={optionOpen} product={product} onClose={() => setOptionOpen(false)} onConfirm={confirmOptions} />
    </>
  );
}
