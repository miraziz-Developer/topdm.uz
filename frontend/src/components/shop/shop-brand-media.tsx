"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Sparkles, Store } from "lucide-react";

import { BRAND } from "@/components/brand/brand-tokens";
import { SHOP_COVER_DEFAULT, shopInitials } from "@/lib/shop-branding";
import { cn } from "@/lib/utils";

type ShopCoverMediaProps = {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
};

/** Muqova: yuklangan rasm yoki premium default; 404 da default ga qaytadi. */
export function ShopCoverMedia({ src, alt = "", className, priority }: ShopCoverMediaProps) {
  const isDefaultAsset = src === SHOP_COVER_DEFAULT || src.endsWith("bozorliii-shop-cover-default.svg");
  const [failed, setFailed] = useState(false);
  const displaySrc = failed || !src ? SHOP_COVER_DEFAULT : src;

  const onError = useCallback(() => setFailed(true), []);

  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      priority={priority}
      sizes="(max-width: 768px) 100vw, 1152px"
      unoptimized={isDefaultAsset || displaySrc === SHOP_COVER_DEFAULT}
      onError={onError}
    />
  );
}

type ShopLogoAvatarProps = {
  shopName: string;
  src: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const LOGO_SIZE: Record<NonNullable<ShopLogoAvatarProps["size"]>, string> = {
  sm: "h-11 w-11 text-sm",
  md: "h-24 w-24 text-2xl sm:h-28 sm:w-28",
  lg: "h-32 w-32 text-3xl",
};

/** Logo: yuklangan rasm yoki bosh harflar + premium gradient. */
export function ShopLogoAvatar({ shopName, src, className, size = "md" }: ShopLogoAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const initials = shopInitials(shopName);

  if (showImage && src) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-2xl bg-surface ring-4 ring-surface shadow-lg",
          LOGO_SIZE[size],
          className,
        )}
      >
        <Image
          src={src}
          alt={shopName}
          fill
          className="object-cover"
          sizes={size === "sm" ? "44px" : "112px"}
          unoptimized
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#0066ff] via-[#4f46e5] to-[#ff6b35] font-bold tracking-tight text-white shadow-lg ring-4 ring-surface",
        LOGO_SIZE[size],
        className,
      )}
      aria-hidden={false}
      role="img"
      aria-label={shopName}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
      <span className="relative z-10 drop-shadow-sm">{initials}</span>
      <Sparkles className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 text-white/70" aria-hidden />
    </div>
  );
}

/** Kichik kartochkalar uchun (mahsulot sahifasi). */
export function ShopLogoChip({
  shopName,
  src,
  className,
}: {
  shopName: string;
  src: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <div
        className={cn(
          "relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5",
          className,
        )}
      >
        <Image
          src={src}
          alt={shopName}
          fill
          className="object-cover"
          sizes="44px"
          unoptimized
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066ff] to-[#4f46e5] text-xs font-bold text-white shadow-sm ring-1 ring-black/5",
        className,
      )}
      aria-label={shopName}
    >
      {shopInitials(shopName)}
    </div>
  );
}

/** Muqova ustidagi yengil brend watermark (ixtiyoriy). */
export function ShopCoverBrandBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm",
        className,
      )}
    >
      <Store className="h-3 w-3" aria-hidden />
      {BRAND.shortName}
    </span>
  );
}
