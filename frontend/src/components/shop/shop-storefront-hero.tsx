"use client";

import { BadgeCheck, Copy, MapPin, Package, Share2, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ShopCoverBrandBadge, ShopCoverMedia, ShopLogoAvatar } from "@/components/shop/shop-brand-media";
import {
  shopCardShell,
  shopTypeChip,
  shopTypeEyebrow,
  shopTypeLead,
  shopTypeMeta,
} from "@/components/shop/shop-premium-ui";
import { hasCustomShopCover, resolveShopCoverUrl, resolveShopLogoUrl } from "@/lib/shop-branding";
import { getShopStorefrontMeta } from "@/lib/shop-storefront";
import { cn } from "@/lib/utils";
import type { ShopProfile } from "@/types";

type Props = {
  shop: ShopProfile;
  productCount: number;
  coverFromProduct?: string | null;
  onBrowseCatalog?: () => void;
};

function displayShopName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function ShopStorefrontHero({ shop, productCount, coverFromProduct, onBrowseCatalog }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const coverSrc = useMemo(
    () => resolveShopCoverUrl(shop, coverFromProduct),
    [shop, coverFromProduct],
  );
  const logoSrc = useMemo(
    () => resolveShopLogoUrl(shop, coverFromProduct),
    [shop, coverFromProduct],
  );
  const showCoverBadge = !hasCustomShopCover(shop) && !coverFromProduct;
  const { locationLine, chips } = useMemo(() => getShopStorefrontMeta(shop), [shop]);
  const rating = shop.rating > 0 ? shop.rating : null;
  const reviews = shop.review_count ?? 0;
  const shopTitle = displayShopName(shop.name);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://bozorliii.online/shop/${shop.slug}`;
    return `${window.location.origin}/shop/${shop.slug}`;
  }, [shop.slug]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash("Havola nusxalandi");
    } catch {
      flash("Nusxalab bo'lmadi");
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.name, text: shop.description ?? shop.name, url: shareUrl });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copyLink();
  };

  return (
    <section className={cn("shop-storefront-hero", shopCardShell)}>
      <div className="relative h-44 sm:h-52 md:h-60">
        <ShopCoverMedia src={coverSrc} priority alt={`${shopTitle} muqovasi`} />
        {showCoverBadge ? <ShopCoverBrandBadge /> : null}
        <div className="shop-hero-cover-overlay" />
        <div className="shop-hero-cover-shine" aria-hidden />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6">
          {shop.is_verified ? (
            <span className="shop-hero-verified-pill">
              <BadgeCheck className="h-3.5 w-3.5" />
              Tasdiqlangan sotuvchi
            </span>
          ) : null}
          {productCount > 0 ? (
            <span className="shop-hero-stat-pill">
              <Zap className="h-3.5 w-3.5 text-amber-300" />
              Yangi kolleksiya
            </span>
          ) : (
            <span className="shop-hero-stat-pill">
              <Package className="h-3.5 w-3.5 opacity-80" />
              Tez kunda mahsulotlar
            </span>
          )}
        </div>

        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 sm:left-6 sm:right-6">
          {rating != null ? (
            <span className="shop-hero-stat-pill">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              <span className="tabular-nums">{rating.toFixed(1)}</span>
              {reviews > 0 ? <span className="text-white/60">· {reviews} baho</span> : null}
            </span>
          ) : null}
          <span className="shop-hero-stat-pill">
            <Package className="h-3.5 w-3.5 opacity-80" />
            {productCount} mahsulot
          </span>
        </div>
      </div>

      <div className="relative px-4 pb-6 pt-0 sm:px-6 sm:pb-7">
        <div className="relative z-10 -mt-12 sm:-mt-14">
          <div className="shop-hero-identity-strip">
            <ShopLogoAvatar shopName={shop.name} src={logoSrc} size="md" className="shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className={shopTypeEyebrow}>Do&apos;kon vitrinasi</p>
              <h1 className="shop-hero-shop-name">{shopTitle}</h1>
              {locationLine ? (
                <p className={cn(shopTypeMeta, "flex items-start gap-2 text-text-400")}>
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-electric-500" aria-hidden />
                  <span className="line-clamp-2 leading-relaxed">{locationLine}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 sm:max-w-xl" />
            <div className="flex flex-col gap-2 sm:ml-auto sm:items-end">
              {notice ? (
                <p className="rounded-xl bg-[#eef4ff] px-3 py-1.5 text-[12px] font-medium text-[#1d4ed8] ring-1 ring-[#bfdbfe]/60">
                  {notice}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {productCount > 0 ? (
                  <button
                    type="button"
                    className="sales-cta shop-cta-pulse inline-flex items-center gap-2 px-5 py-2.5 text-[13px]"
                    onClick={onBrowseCatalog}
                  >
                    Mahsulotlarni ko&apos;rish
                  </button>
                ) : (
                  <Link
                    href={`/map?shop=${encodeURIComponent(shop.slug)}`}
                    className="sales-cta shop-cta-pulse inline-flex items-center gap-2 px-5 py-2.5 text-[13px]"
                  >
                    <MapPin className="h-4 w-4" />
                    Do&apos;konni topish
                  </Link>
                )}
                <Link
                  href={`/map?shop=${encodeURIComponent(shop.slug)}`}
                  className="shop-hero-btn shop-hero-btn--secondary"
                >
                  <MapPin className="h-4 w-4" />
                  Xaritada
                </Link>
                <button type="button" className="shop-hero-btn shop-hero-btn--secondary" onClick={() => void shareNative()}>
                  <Share2 className="h-4 w-4" />
                  Ulashish
                </button>
                <button type="button" className="shop-hero-btn shop-hero-btn--ghost" onClick={() => void copyLink()} aria-label="Havolani nusxalash">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-black/[0.05] pt-5">
            {shop.description ? (
              <p className={cn(shopTypeLead, "max-w-2xl")}>{shop.description}</p>
            ) : (
              <p className={cn(shopTypeLead, "max-w-2xl")}>
                <span className="font-medium text-ink-700">Onlayn tanlang</span>
                <span className="text-text-400"> — do&apos;konda naqd yoki terminalda to&apos;lang. Tez va xavfsiz bron.</span>
              </p>
            )}

            {chips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span key={chip} className={shopTypeChip}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
