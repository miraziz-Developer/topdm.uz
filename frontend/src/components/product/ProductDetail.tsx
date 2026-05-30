"use client";

import { Copy, Eye, MapPin, Phone, Store } from "lucide-react";
import Link from "next/link";

import { GroupBuyPricing } from "@/components/ui/group-buy-pricing";
import { Button } from "@/components/ui/button";
import { SellerBadges } from "@/components/ui/seller-badges";
import { StockStatus } from "@/components/ui/stock-status";
import { buildMapFocusHref } from "@/lib/map-stores";
import { selectionLabel, type ProductSelectionOptions } from "@/lib/product-options";
import { formatShopLocationBadge, parseShopLocation } from "@/lib/shop-location";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(value: string) {
  return UUID_PATTERN.test(value.trim());
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

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onCopyId}
          className="group flex max-w-full items-center gap-1.5 text-left text-[11px] text-text-400 transition-colors hover:text-text-300"
          aria-label="Mahsulot ID nusxalash"
        >
          <span className="truncate font-mono">{product.id}</span>
          <Copy className="h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {product.category && !isUuidLike(product.category) ? (
            <span className="inline-flex rounded-full bg-elevated px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
              {product.category}
            </span>
          ) : null}
          <SellerBadges product={product} />
        </div>
        <h1 className="break-anywhere text-xl font-bold leading-tight text-ink-900 sm:text-2xl md:text-3xl">{product.name}</h1>
      </header>

      <StockStatus product={product} />

      <div className="space-y-3">
        <div className="flex items-center gap-3 text-ink-700">
          <Store className="h-5 w-5 shrink-0 text-electric-500" />
          <span className="font-medium">{product.shop.name}</span>
        </div>

        <div
          className={cn(
            "rounded-2xl border border-electric-500/15 bg-gradient-to-br from-electric-500/[0.06] to-white px-4 py-3",
            "shadow-sm ring-1 ring-black/[0.03]",
          )}
        >
          <p className="flex items-start gap-2 text-sm font-medium leading-snug text-ink-800">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" aria-hidden />
            <span>{locationBadge}</span>
          </p>
        </div>
      </div>

      <GroupBuyPricing
        product={product}
        onReserve={onReserveGroup}
        preferredOptions={selectedOptions}
        forceInlineSelection={forceInlineSelection}
        onRequireSelection={onRequireSelection}
      />
      {selectionLabel(selectedOptions) ? (
        <p className="text-xs text-ink-500">Tanlangan: {selectionLabel(selectedOptions)}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={mapHref} className="flex-1">
          <Button
            size="lg"
            variant="secondary"
            className="w-full whitespace-nowrap text-ink-900"
            leftIcon={<MapPin className="h-5 w-5" />}
          >
            Xaritada ko&apos;rish
          </Button>
        </Link>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1 whitespace-nowrap text-ink-900"
          leftIcon={<Phone className="h-5 w-5" />}
          onClick={onBandOpen}
        >
          Band qilish
        </Button>
      </div>

      <span className="flex items-center gap-1.5 text-sm text-ink-500">
        <Eye className="h-4 w-4" /> {product.view_count || 0} ko&apos;rildi
      </span>
    </div>
  );
}
