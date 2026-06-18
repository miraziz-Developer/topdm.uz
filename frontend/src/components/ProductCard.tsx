"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Heart, Phone, Share2, ShoppingBag } from "lucide-react";
import { BlurImage } from "@/components/ui/blur-image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ProductOptionModal } from "@/components/product/product-option-modal";
import { ProductRatingStars } from "@/components/product/product-rating-stars";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/lib/haptics";
import { isUuidLike, productImage } from "@/lib/media";
import { cardHover } from "@/lib/motion-presets";
import { extractSelectableOptions, type ProductSelectionOptions } from "@/lib/product-options";
import { productDiscountPercent } from "@/lib/deal-pricing";
import { productPriceUzs } from "@/lib/product-price";
import { optomCardHint, priceUnitSuffix } from "@/lib/wholesale";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useFlyToCartStore } from "@/stores/fly-to-cart-store";
import { useWatchlistStore } from "@/stores/watchlist-store";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  variant?: "grid" | "list" | "compact" | "featured";
  aspectRatio?: "square" | "video";
  priority?: boolean;
  onBand?: (product: Product) => void;
  onOpen?: (product: Product) => void;
}

export function ProductCard({
  product,
  variant = "grid",
  aspectRatio = "square",
  priority = false,
  onBand,
  onOpen,
}: ProductCardProps) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-60, 60], [8, -8]), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-60, 60], [-8, 8]), { stiffness: 220, damping: 20 });
  const addItem = useCartStore((state) => state.addItem);
  const launch = useFlyToCartStore((state) => state.launch);
  const isFavorite = useWatchlistStore((state) => state.isFavorite(product.id));
  const toggleFavorite = useWatchlistStore((state) => state.toggleFavorite);
  const { formatPrice } = useCurrency();
  const imageUrl = productImage(product.images);
  const displayName = product.name?.trim() && !isUuidLike(product.name) ? product.name : "Mahsulot";
  const displayCategory =
    product.category && !isUuidLike(product.category) ? product.category : "Kiyim";
  const baseUzs = productPriceUzs(product);
  const discountPct = productDiscountPercent(product);
  const optomHint = optomCardHint(product, formatPrice);
  const unitSuffix = priceUnitSuffix(product);
  const [optionOpen, setOptionOpen] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);

  const openProduct = () => {
    onOpen?.(product);
    router.push(`/product/${product.id}`);
  };

  const addToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    triggerHaptic();
    const rect = event.currentTarget.getBoundingClientRect();
    const opts = extractSelectableOptions(product);
    if (opts.sizes.length || opts.colors.length) {
      setPendingPoint({ x: rect.left, y: rect.top });
      setOptionOpen(true);
      return;
    }
    launch({ image: imageUrl, x: rect.left, y: rect.top });
    addItem(product, 1, "single");
  };

  const confirmOptions = (selectedOptions: ProductSelectionOptions) => {
    if (pendingPoint) {
      launch({ image: imageUrl, x: pendingPoint.x, y: pendingPoint.y });
    }
    addItem(product, 1, "single", selectedOptions);
    setOptionOpen(false);
    setPendingPoint(null);
  };

  const content = (
  <>
      <motion.div
        ref={ref}
        style={{ rotateX, rotateY, transformPerspective: 900 }}
        onMouseMove={(event) => {
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          x.set(event.clientX - rect.left - rect.width / 2);
          y.set(event.clientY - rect.top - rect.height / 2);
        }}
        onMouseLeave={() => {
          x.set(0);
          y.set(0);
        }}
        {...cardHover}
        className={cn(
          "pin-card group relative overflow-hidden border border-border-subtle",
          variant === "list" ? "flex w-full gap-4 p-3" : "flex w-full flex-col",
          variant === "compact" ? "max-w-[180px]" : "w-full",
        )}
      >
        <motion.div className="pointer-events-none absolute -inset-2 rounded-[28px] bg-electric-500/0 opacity-0 blur-2xl transition duration-500 group-hover:bg-electric-500/15 group-hover:opacity-100" />
        <div
          className={cn(
            "relative overflow-hidden bg-elevated",
            variant === "list" ? "h-28 w-28 flex-shrink-0 rounded-xl" : "w-full",
            variant !== "list" && (aspectRatio === "square" ? "aspect-square" : "aspect-[4/3]"),
          )}
        >
          <BlurImage
            src={imageUrl}
            alt={displayName}
            fill
            priority={priority}
            wrapperClassName="absolute inset-0"
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes={variant === "list" ? "112px" : "(max-width: 768px) 50vw, 25vw"}
          />
          {typeof product.visual_match_pct === "number" && product.visual_match_pct >= 35 ? (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-electric-500/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              Rasm {product.visual_match_pct}%
            </span>
          ) : null}
          <motion.div className="absolute inset-0 bg-black/15 opacity-0 transition group-hover:opacity-100" />
          <motion.div className="absolute right-2 top-2 flex flex-col gap-2">
            <button
              type="button"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-ink-700 backdrop-blur transition hover:bg-neon-500 hover:text-white",
                isFavorite && "bg-neon-500 text-white",
              )}
              onClick={(event) => {
                event.stopPropagation();
                triggerHaptic();
                toggleFavorite(product);
              }}
              aria-label="Sevimlilar"
            >
              <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-ink-700 backdrop-blur transition hover:bg-ink-900 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                void navigator.share?.({
                  title: product.name,
                  url: `${window.location.origin}/product/${product.id}`,
                });
              }}
              aria-label="Ulashish"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </motion.div>
          <div className="absolute bottom-2 left-2 flex flex-col gap-1">
            {discountPct != null && discountPct > 0 ? (
              <span className="w-fit rounded-md bg-neon-500 px-2 py-0.5 text-[10px] font-black text-white">
                -{discountPct}%
              </span>
            ) : null}
            <span
              className={cn(
                "w-fit rounded-full px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur",
                product.is_available ? "bg-green/90" : "bg-red/90",
              )}
            >
              {product.is_available ? "Mavjud" : "Sotilgan"}
            </span>
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col", variant === "list" ? "min-w-0 py-1" : "p-3")}>
          <div className="text-xs text-ink-500">
            {displayCategory} • {product.shop?.ipadrom || "Bozor"}
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold text-ink-900">{displayName}</h3>
          {(product.review_summary?.review_count ?? 0) > 0 ? (
            <div className="mt-1 flex items-center gap-1.5">
              <ProductRatingStars rating={product.review_summary?.average_rating ?? 0} size="sm" />
              <span className="text-xs text-ink-500">({product.review_summary?.review_count})</span>
            </div>
          ) : null}
          <div className="mt-3 flex items-end justify-between gap-2">
            <motion.div>
              <p className="price-mono text-lg font-bold text-neon-500">
                {formatPrice(baseUzs)}
                {unitSuffix ? <span className="ml-0.5 text-xs font-medium text-ink-500">{unitSuffix}</span> : null}
              </p>
              {optomHint ? <p className="mt-0.5 text-[10px] font-semibold text-electric-600">{optomHint}</p> : null}
            </motion.div>
            <span className="truncate text-xs text-ink-500">⭐ {product.shop.name}</span>
          </div>
          {variant !== "compact" ? (
            <div className={cn("mt-3 flex gap-2", variant === "list" && "sm:mt-auto")}>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                leftIcon={<ShoppingBag className="h-3.5 w-3.5" />}
                onClick={addToCart}
              >
                Savatcha
              </Button>
              {onBand ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  leftIcon={<Phone className="h-3.5 w-3.5" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onBand(product);
                  }}
                >
                  Band
                </Button>
              ) : null}
            </div>
          ) : onBand ? (
            <Button
              variant="primary"
              size="sm"
              className="mt-2 w-full"
              leftIcon={<Phone className="h-3 w-3" />}
              onClick={(event) => {
                event.stopPropagation();
                onBand(product);
              }}
            >
              Band
            </Button>
          ) : null}
        </div>
      </motion.div>
  </>
  );

  return (
    <>
      <div className="w-full text-left" onClick={openProduct} onKeyDown={(event) => event.key === "Enter" && openProduct()} role="link" tabIndex={0}>
        {content}
      </div>
      <ProductOptionModal isOpen={optionOpen} product={product} onClose={() => setOptionOpen(false)} onConfirm={confirmOptions} />
    </>
  );
}
