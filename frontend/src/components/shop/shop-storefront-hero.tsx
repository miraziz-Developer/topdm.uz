"use client";

import { BadgeCheck, Copy, MapPin, Share2, Star, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { resolveMediaUrl } from "@/lib/media";
import type { ShopProfile } from "@/types";

type Props = {
  shop: ShopProfile;
  productCount: number;
  coverFromProduct?: string | null;
};

function formatLocation(shop: ShopProfile) {
  const parts = [
    shop.floor,
    shop.section,
    shop.address_label,
    shop.ipadrom_name || shop.ipadrom,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function ShopStorefrontHero({ shop, productCount, coverFromProduct }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const cover = resolveMediaUrl(
    shop.storefront_image_url || shop.logo_url || coverFromProduct || "",
  );
  const logo = resolveMediaUrl(shop.logo_url || coverFromProduct || "");
  const location = formatLocation(shop);
  const rating = shop.rating > 0 ? shop.rating : null;
  const reviews = shop.review_count ?? 0;

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://topdim.uz/shop/${shop.slug}`;
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
    <section className="shop-storefront-hero overflow-hidden rounded-[1.75rem] border border-border-subtle bg-surface shadow-[var(--shadow-elevated)]">
      <div className="relative h-36 sm:h-44 md:h-52">
        {cover && cover !== "/brand/topdim-product-placeholder.svg" ? (
          <Image src={cover} alt="" fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 1152px" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-electric-500/25 via-indigo-500/15 to-amber-400/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(0,102,255,0.35),transparent)]" />
      </div>

      <div className="relative px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface ring-4 ring-surface shadow-lg sm:h-28 sm:w-28">
              {logo && logo !== "/brand/topdim-product-placeholder.svg" ? (
                <Image src={logo} alt={shop.name} fill className="object-cover" sizes="112px" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-electric-500/10 text-electric-600">
                  <Store className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-text-100 sm:text-3xl">{shop.name}</h1>
                {shop.is_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-electric-500/10 px-2.5 py-1 text-xs font-semibold text-electric-600 ring-1 ring-electric-500/20">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Tasdiqlangan
                  </span>
                ) : null}
              </div>
              {rating != null ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-text-300">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-text-100">{rating.toFixed(1)}</span>
                  {reviews > 0 ? <span className="text-text-400">({reviews} baho)</span> : null}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 sm:pb-1">
            {notice ? (
              <p className="rounded-lg bg-electric-500/10 px-3 py-1.5 text-xs font-semibold text-electric-600 ring-1 ring-electric-500/20">
                {notice}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
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
            <button type="button" className="shop-hero-btn shop-hero-btn--ghost" onClick={() => void copyLink()}>
              <Copy className="h-4 w-4" />
            </button>
            </div>
          </div>
        </div>

        {shop.description ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-300">{shop.description}</p>
        ) : (
          <p className="mt-4 text-sm text-text-400">Ayollar moda va aksessuarlar — onlayn ko&apos;rib, bron qiling</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {location ? (
            <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-medium text-text-300 ring-1 ring-border-subtle">
              {location}
            </span>
          ) : null}
          <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-medium text-text-300 ring-1 ring-border-subtle">
            {productCount} ta mahsulot
          </span>
          {shop.is_featured ? (
            <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/20">
              Tavsiya etilgan
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
