"use client";

import { motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SALES } from "@/components/brand/sales-ui";
import { ProductOptionModal } from "@/components/product/product-option-modal";
import { ProductRatingStars } from "@/components/product/product-rating-stars";
import { useCurrency } from "@/components/providers/currency-provider";
import { ProductPinImage } from "@/components/ui/product-pin-image";
import { useT } from "@/i18n/locale-provider";
import { triggerHaptic } from "@/lib/haptics";
import { isUuidLike } from "@/lib/media";
import { extractSelectableOptions, type ProductSelectionOptions } from "@/lib/product-options";
import { productDiscountPercent, formatSoldCount } from "@/lib/deal-pricing";
import { isLowStock } from "@/lib/product-stock";
import { isOptomProduct, optomCardHint, priceUnitSuffix } from "@/lib/wholesale";
import { productPriceUzs } from "@/lib/product-price";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useFlyToCartStore } from "@/stores/fly-to-cart-store";
import { useWatchlistStore } from "@/stores/watchlist-store";
import type { Product } from "@/types";

const PIN_ASPECTS = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[2/3]",
  "aspect-[5/7]",
  "aspect-[3/5]",
  "aspect-[4/6]",
] as const;

type DiscoveryProductCardProps = {
  product: Product;
  priority?: boolean;
  index?: number;
  onBand?: (product: Product) => void;
  bulkMode?: boolean;
  /** Do'kon sahifasida bir xil kart balandligi */
  uniformAspect?: boolean;
};

export function pinAspectForIndex(index: number, productId: string): string {
  const seed = index + productId.charCodeAt(0) + (productId.charCodeAt(productId.length - 1) ?? 0);
  return PIN_ASPECTS[seed % PIN_ASPECTS.length];
}

export function DiscoveryProductCard({
  product,
  priority = false,
  index = 0,
  onBand,
  bulkMode = false,
  uniformAspect = false,
}: DiscoveryProductCardProps) {
  const router = useRouter();
  const t = useT();
  const { formatPrice } = useCurrency();
  const addItem = useCartStore((state) => state.addItem);
  const launch = useFlyToCartStore((state) => state.launch);
  const isFavorite = useWatchlistStore((state) => state.isFavorite(product.id));
  const toggleFavorite = useWatchlistStore((state) => state.toggleFavorite);

  const displayName =
    product.name?.trim() && !isUuidLike(product.name) ? product.name : t("home.pin.productFallback");
  const basePriceUzs = productPriceUzs(product);
  const isOptom = bulkMode || isOptomProduct(product);
  const minQty = product.min_order_quantity ?? 1;
  const aspectClass = uniformAspect ? "aspect-[3/4]" : isOptom ? "aspect-[4/3]" : pinAspectForIndex(index, product.id);
  const displayPriceUzs = basePriceUzs;
  const optomHint = optomCardHint(product, formatPrice);
  const unitSuffix = priceUnitSuffix(product);
  const reviewCount = product.review_summary?.review_count ?? 0;
  const avgRating = product.review_summary?.average_rating ?? 0;
  const discountPct = productDiscountPercent(product);
  const soldLabel = formatSoldCount(product.sold_count ?? 0);

  const isChina = product.market_source === "china";
  const open = () => router.push(product.detail_path ?? `/product/${product.id}`);
  const [optionOpen, setOptionOpen] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<"cart" | "checkout">("cart");

  const addToCart = (event: React.MouseEvent) => {
    event.stopPropagation();
    triggerHaptic();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const opts = extractSelectableOptions(product);
    if (opts.sizes.length || opts.colors.length) {
      setPendingPoint({ x: rect.left, y: rect.top });
      setPendingAction("cart");
      setOptionOpen(true);
      return;
    }
    const thumb = product.images?.[0];
    launch({ image: thumb ?? "", x: rect.left, y: rect.top });
    addItem(product, 1, "single");
  };

  const buyNow = (event: React.MouseEvent) => {
    event.stopPropagation();
    triggerHaptic();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const opts = extractSelectableOptions(product);
    if (opts.sizes.length || opts.colors.length) {
      setPendingPoint({ x: rect.left, y: rect.top });
      setPendingAction("checkout");
      setOptionOpen(true);
      return;
    }
    const thumb = product.images?.[0];
    launch({ image: thumb ?? "", x: rect.left, y: rect.top });
    addItem(product, 1, "single");
    router.push("/checkout");
  };

  const confirmOptions = (selectedOptions: ProductSelectionOptions) => {
    const thumb = product.images?.[0];
    if (pendingPoint) {
      launch({ image: thumb ?? "", x: pendingPoint.x, y: pendingPoint.y });
    }
    addItem(product, 1, "single", selectedOptions);
    setOptionOpen(false);
    setPendingPoint(null);
    if (pendingAction === "checkout") {
      router.push("/checkout");
    }
  };

  const savePin = (event: React.MouseEvent) => {
    event.stopPropagation();
    triggerHaptic();
    toggleFavorite(product);
  };

  return (
    <>
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.28), duration: 0.4, ease: "easeOut" }}
      className={cn(
        SALES.panel,
        "pin-card group cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:shadow-hover active:scale-[0.985]",
        isOptom && "rounded-2xl border-2 border-electric-500/25 bg-electric-500/5 p-2 shadow-[0_0_24px_rgba(0,102,255,0.14)]",
      )}
      onClick={open}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      <div className="relative">
        <ProductPinImage
          images={product.images}
          alt={displayName}
          priority={priority}
          aspectClass={aspectClass}
        />

        {typeof product.visual_match_pct === "number" && product.visual_match_pct >= 50 ? (
          <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-electric-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {product.visual_match_pct}%
          </span>
        ) : null}
        {isChina ? (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-electric-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            Xitoy
          </span>
        ) : isOptom ? (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-electric-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {t("home.pin.optomMin", { qty: minQty })}
          </span>
        ) : discountPct != null && discountPct > 0 ? (
          <span className="badge-deal absolute left-2.5 top-2.5 z-10">
            -{discountPct}%
          </span>
        ) : null}
        {isLowStock(product) ? (
          <span className="badge-hot absolute bottom-2 left-2.5 z-10">
            Kam qoldi
          </span>
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/40 opacity-0 backdrop-blur-[2px] transition-all duration-300 ease-out group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={buyNow}
            className={cn(
              "sales-cta sales-cta-pulse translate-y-1 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all duration-300 ease-out group-hover:translate-y-0 hover:scale-105 active:scale-95",
            )}
          >
            Sotib olish
          </button>
          <button
            type="button"
            onClick={addToCart}
            className="flex translate-y-1 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-md transition-all duration-300 ease-out group-hover:translate-y-0 hover:scale-105 hover:bg-slate-50 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            Savatchaga
          </button>
          {onBand ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBand(product);
              }}
              className="rounded-full border border-white/60 bg-white/20 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/30"
            >
              {t("home.pin.band")}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={savePin}
          className={cn(
            "absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink-600 shadow-md transition",
            "opacity-0 group-hover:opacity-100",
            isFavorite && "bg-neon-500 text-white opacity-100",
          )}
          aria-label={t("home.pin.save")}
        >
          <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </button>
      </div>

      <div className="px-2 pb-3 pt-2">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink-900">
          {displayName}
        </h3>
        {product.shop?.location_label || product.shop?.name ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500">
            {product.shop.location_label || product.shop.name}
          </p>
        ) : null}
        {reviewCount > 0 ? (
          <div className="mt-1 flex items-center gap-1.5" aria-label={`${avgRating} yulduz, ${reviewCount} ta sharh`}>
            <ProductRatingStars rating={avgRating} size="sm" />
            <span className="text-[11px] font-medium text-gray-500">({reviewCount})</span>
          </div>
        ) : null}
        <div className="mt-1.5 flex items-baseline gap-1">
          <p className={cn(SALES.priceDeal, "text-sm")}>{formatPrice(displayPriceUzs)}</p>
          {unitSuffix ? <span className="text-[10px] font-medium text-gray-500">{unitSuffix}</span> : null}
        </div>
        {optomHint ? (
          <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-snug text-electric-600">{optomHint}</p>
        ) : null}
        {soldLabel || reviewCount > 0 ? (
          <p className={cn(SALES.socialProof, "mt-1")}>
            {soldLabel ? `${soldLabel} sotilgan` : null}
            {soldLabel && reviewCount > 0 ? " · " : null}
            {reviewCount > 0 ? `${reviewCount} sharh` : null}
          </p>
        ) : null}
      </div>
    </motion.article>
    <ProductOptionModal isOpen={optionOpen} product={product} onClose={() => setOptionOpen(false)} onConfirm={confirmOptions} />
    </>
  );
}
