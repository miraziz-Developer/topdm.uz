"use client";

import { motion } from "framer-motion";
import { Share2, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ProductOptionModal } from "@/components/product/product-option-modal";
import { Button } from "@/components/ui/button";
import { GroupBuyCountdown, useLivePurchaseToasts } from "@/components/ui/group-buy-live";
import { PriceBlock, type PriceMode } from "@/components/product/price-block";
import { triggerHaptic } from "@/lib/haptics";
import { productImage } from "@/lib/media";
import { extractSelectableOptions, type ProductSelectionOptions } from "@/lib/product-options";
import { getGroupPrice, GROUP_MIN_MEMBERS } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
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
  const [mode, setMode] = useState<PriceMode>("group");
  const shareLockRef = useRef(false);
  const addItem = useCartStore((state) => state.addItem);
  const launch = useFlyToCartStore((state) => state.launch);
  const groupPrice = getGroupPrice(product.price);
  const [optionOpen, setOptionOpen] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);

  useLivePurchaseToasts(mode === "group");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("group") === "1") setMode("group");
  }, []);

  const shareGroup = async () => {
    if (shareLockRef.current) return;
    const url = `${window.location.origin}/product/${product.id}?group=1`;
    shareLockRef.current = true;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `${GROUP_MIN_MEMBERS} kishi bilan ${formatPrice(groupPrice)} ga oling`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore clipboard failures
      }
    } finally {
      shareLockRef.current = false;
    }
  };

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
        addItem(product, 1, mode, resolvedOptions);
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
    addItem(product, 1, mode, resolvedOptions);
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
    addItem(product, 1, mode, selectedOptions);
    onReserve?.();
    setOptionOpen(false);
    setPendingPoint(null);
  };

  return (
    <>
    <div className="rounded-3xl border border-border-subtle bg-white p-5 shadow-card">
      <PriceBlock price={product.price} mode={mode} onModeChange={setMode} />
      {mode === "group" ? (
        <motion.div className="mt-3 space-y-2">
          <GroupBuyCountdown />
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <motion.div
              className="h-full rounded-full bg-gradient-gold"
              initial={{ width: "66%" }}
              animate={{ width: "50%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-ink-500">Yana 1 kishi kerak — guruh narxi faollashadi</p>
        </motion.div>
      ) : null}
      <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button className="flex-1 whitespace-nowrap" size="lg" onClick={addToCart} leftIcon={<ShoppingBag className="h-5 w-5" />}>
          {mode === "group" ? "Guruh buyurtmasi" : "Yakka xarid"}
        </Button>
        {mode === "group" ? (
          <Button
            className="flex-1 whitespace-nowrap"
            size="lg"
            variant="secondary"
            onClick={() => void shareGroup()}
            leftIcon={<Share2 className="h-5 w-5" />}
          >
            Do&apos;stga yuborish
          </Button>
        ) : null}
      </motion.div>
    </div>
    <ProductOptionModal isOpen={optionOpen} product={product} onClose={() => setOptionOpen(false)} onConfirm={confirmOptions} />
    </>
  );
}
