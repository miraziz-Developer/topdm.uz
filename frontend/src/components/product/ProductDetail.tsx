"use client";

import { ChevronRight, Copy, Eye, MapPin, MessageSquare, Phone, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  productBuyCard,
  productBuyCardInner,
  productShopCard,
} from "@/components/product/product-premium-ui";
import { ProductRatingStars } from "@/components/product/product-rating-stars";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { SellerBadges } from "@/components/ui/seller-badges";
import { StockStatus } from "@/components/ui/stock-status";
import { triggerHaptic } from "@/lib/haptics";
import { buildMapFocusHref } from "@/lib/map-stores";
import { ShopLogoChip } from "@/components/shop/shop-brand-media";
import { resolveShopLogoUrl } from "@/lib/shop-branding";
import { extractSelectableOptions, selectionLabel, type ProductSelectionOptions } from "@/lib/product-options";
import { formatShopLocationBadge, parseShopLocation } from "@/lib/shop-location";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(value: string) {
  return UUID_PATTERN.test(value.trim());
}

function ReviewSummaryStrip({ product }: { product: Product }) {
  const summary = product.review_summary;
  const hasReviews = summary && summary.review_count > 0;

  if (hasReviews) {
    return (
      <Link
        href="#product-reviews"
        className="group inline-flex w-full max-w-md items-center gap-3 rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50/90 to-white px-4 py-3 transition-all hover:border-amber-300/80 hover:shadow-[0_8px_24px_-12px_rgba(245,158,11,0.35)]"
      >
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums leading-none text-ink-900">
            {summary.average_rating.toFixed(1)}
          </p>
          <ProductRatingStars rating={summary.average_rating} size="sm" className="mt-1 justify-center" />
        </div>
        <div className="min-w-0 flex-1 border-l border-amber-200/50 pl-3">
          <p className="text-sm font-semibold text-ink-800">{summary.review_count} ta sharh</p>
          <p className="text-xs text-ink-500 group-hover:text-brand-600">Barcha sharhlarni ko&apos;rish →</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500" />
      </Link>
    );
  }

  return (
    <Link
      href="#product-reviews"
      className="inline-flex w-full max-w-md items-center justify-between gap-2 rounded-2xl border border-dashed border-ink-200/80 bg-white/60 px-4 py-3 text-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30"
    >
      <span className="flex items-center gap-2 text-ink-600">
        <ProductRatingStars rating={0} size="sm" />
        <span>Hali baho yo&apos;q — birinchi sharhni yozing</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
    </Link>
  );
}

type ProductDetailProps = {
  product: Product;
  onCopyId: () => void;
  onReserveGroup: () => void;
  onBandOpen: () => void;
  selectedOptions?: ProductSelectionOptions;
  forceInlineSelection?: boolean;
  onRequireSelection?: () => void;
};

export function ProductDetail({
  product,
  onCopyId,
  onReserveGroup,
  onBandOpen,
  selectedOptions,
  forceInlineSelection = false,
  onRequireSelection,
}: ProductDetailProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const addItem = useCartStore((state) => state.addItem);
  const locationBadge = formatShopLocationBadge(product.shop);
  const pin = parseShopLocation(product.shop);
  const mapHref = product.shop?.id
    ? buildMapFocusHref({
        merchantId: product.shop.id,
        shopSlug: product.shop.slug,
        block: pin.block,
        stall: pin.stall,
        focus: true,
        source: "product",
      })
    : "/map";
  const shopHref = product.shop?.slug ? `/shop/${product.shop.slug}` : null;

  const buyNow = () => {
    triggerHaptic();
    const opts = extractSelectableOptions(product);
    const inlineMissing =
      forceInlineSelection &&
      ((opts.sizes.length > 0 && !selectedOptions?.size) || (opts.colors.length > 0 && !selectedOptions?.color));
    if (inlineMissing) {
      onRequireSelection?.();
      return;
    }
    addItem(product, 1, "single", selectedOptions);
    onReserveGroup();
    router.push("/checkout");
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="space-y-3">
        <button
          type="button"
          onClick={onCopyId}
          className="group flex max-w-full items-center gap-1.5 text-left text-[10px] uppercase tracking-wider text-ink-400 transition-colors hover:text-ink-600"
          aria-label="Mahsulot ID nusxalash"
        >
          <span className="truncate font-mono normal-case tracking-normal">{product.id.slice(0, 8)}…</span>
          <Copy className="h-3 w-3 flex-shrink-0 opacity-50 group-hover:opacity-100" />
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {product.category && !isUuidLike(product.category) ? (
            <span className="inline-flex rounded-full bg-ink-900/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
              {product.category}
            </span>
          ) : null}
          <SellerBadges product={product} />
        </div>

        <h1 className="break-anywhere text-2xl font-semibold leading-[1.2] tracking-tight text-ink-900 sm:text-[1.65rem]">
          {product.name}
        </h1>

        <ReviewSummaryStrip product={product} />
        <StockStatus product={product} />
      </header>

      <div className={productShopCard}>
        <ShopLogoChip
          shopName={product.shop.name}
          src={resolveShopLogoUrl({ logo_url: product.shop?.logo_url })}
        />
        <div className="min-w-0 flex-1">
          {shopHref ? (
            <Link href={shopHref} className="group flex items-center gap-1">
              <span className="truncate text-sm font-semibold text-ink-900 group-hover:text-brand-700">
                {product.shop.name}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300 group-hover:text-brand-500" />
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold text-ink-900">{product.shop.name}</p>
          )}
          <p className="mt-0.5 flex items-start gap-1.5 text-xs leading-snug text-ink-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
            <span>{locationBadge}</span>
          </p>
        </div>
      </div>

      <div className={productBuyCard}>
        <div className="border-b border-black/[0.05] bg-gradient-to-br from-[#faf9f7] to-white px-5 py-4 sm:px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">Narx</p>
          <p className="price-mono mt-1 text-[1.75rem] font-bold leading-none tracking-tight text-ink-900 sm:text-3xl">
            {formatPrice(product.price)}
          </p>
          <p className="mt-2 text-xs text-ink-500">Yetkazib berish yoki do&apos;kondan olib ketish</p>
        </div>
        <div className={cn(productBuyCardInner, "space-y-3")}>
          <Button
            className="h-12 w-full rounded-xl text-base font-semibold shadow-[0_8px_24px_-8px_rgba(37,99,235,0.45)]"
            size="lg"
            variant="brand"
            onClick={buyNow}
            leftIcon={<ShoppingBag className="h-5 w-5" />}
          >
            Sotib olish
          </Button>
          {selectionLabel(selectedOptions) ? (
            <p className="text-center text-xs text-ink-500">
              Tanlangan: <span className="font-medium text-ink-700">{selectionLabel(selectedOptions)}</span>
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Link href={mapHref}>
              <Button
                size="md"
                variant="secondary"
                className="h-11 w-full rounded-xl border-black/[0.06] bg-white font-medium"
                leftIcon={<MapPin className="h-4 w-4" />}
              >
                Xaritada
              </Button>
            </Link>
            <Button
              size="md"
              variant="secondary"
              className="h-11 w-full rounded-xl border-black/[0.06] bg-white font-medium"
              leftIcon={<Phone className="h-4 w-4" />}
              onClick={onBandOpen}
            >
              Band qilish
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-900/[0.03] px-4 py-3 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-ink-400" />
          <span>
            <span className="font-semibold tabular-nums text-ink-700">{product.view_count || 0}</span> ko&apos;rildi
          </span>
        </span>
        <span className="h-3 w-px bg-ink-200" aria-hidden />
        <span>
          <span className="font-semibold tabular-nums text-ink-700">{product.sold_count || 0}</span> marta sotilgan
        </span>
        <Link
          href="#product-reviews"
          className="ml-auto inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Sharhlar
        </Link>
      </div>
    </div>
  );
}
