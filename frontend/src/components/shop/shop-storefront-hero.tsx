"use client";

import { BadgeCheck, Copy, MapPin, Package, Share2, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ShopCoverBrandBadge, ShopCoverMedia, ShopLogoAvatar } from "@/components/shop/shop-brand-media";
import {
  shopCardShell,
  shopTypeChip,
  shopTypeDisplay,
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
    if (typeof window === "undefined") return `https://bozorliii.uz/shop/${shop.slug}`;
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
      <div className="relative h-36 sm:h-44 md:h-52">
        <ShopCoverMedia src={coverSrc} priority />
        {showCoverBadge ? <ShopCoverBrandBadge /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1118]/92 via-[#0c1118]/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(255,255,255,0.08),transparent_50%)]" />

        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 sm:left-6 sm:right-6">
          {rating != null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/95 backdrop-blur-md ring-1 ring-white/10">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              <span className="tabular-nums">{rating.toFixed(1)}</span>
              {reviews > 0 ? <span className="text-white/60">· {reviews} baho</span> : null}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/95 backdrop-blur-md ring-1 ring-white/10">
            <Package className="h-3.5 w-3.5 opacity-80" />
            {productCount} mahsulot
          </span>
        </div>
      </div>

      <div className="relative px-5 pb-6 pt-0 sm:px-7 sm:pb-7">
        <div className="-mt-12 flex flex-col gap-6 sm:-mt-14">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              <ShopLogoAvatar shopName={shop.name} src={logoSrc} size="md" />
              <div className="min-w-0 space-y-2 pb-0.5">
                <p className={shopTypeEyebrow}>Do&apos;kon vitrinasi</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h1 className={cn(shopTypeDisplay, "text-[1.65rem] sm:text-[1.85rem]")}>{shopTitle}</h1>
                  {shop.is_verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#1d4ed8] ring-1 ring-[#bfdbfe]/80">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Tasdiqlangan
                    </span>
                  ) : null}
                </div>
                {locationLine ? (
                  <p className={cn(shopTypeMeta, "flex items-start gap-2 text-text-300")}>
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-400" aria-hidden />
                    <span className="line-clamp-2 leading-relaxed">{locationLine}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              {notice ? (
                <p className="rounded-xl bg-[#eef4ff] px-3 py-1.5 text-[12px] font-medium text-[#1d4ed8] ring-1 ring-[#bfdbfe]/60">
                  {notice}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {productCount > 0 ? (
                  <button
                    type="button"
                    className="shop-hero-btn shop-hero-btn--primary"
                    onClick={onBrowseCatalog}
                  >
                    Mahsulotlarni ko&apos;rish
                  </button>
                ) : null}
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
              <p className={cn(shopTypeLead, "max-w-2xl text-text-400")}>
                Mahsulotlarni onlayn tanlang, do&apos;konda olib keting. Tez va qulay bron tizimi.
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
