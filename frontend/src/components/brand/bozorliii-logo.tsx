"use client";

import Image from "next/image";
import Link from "next/link";

import { BRAND } from "@/components/brand/brand-tokens";
import { cn } from "@/lib/utils";

export type BozorliiiLogoVariant = "icon" | "wordmark" | "full";
export type BozorliiiLogoSize = "xs" | "sm" | "md" | "lg";

const ICON_H: Record<BozorliiiLogoSize, string> = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
};

const WORDMARK_H: Record<BozorliiiLogoSize, string> = {
  xs: "h-6",
  sm: "h-7",
  md: "h-8",
  lg: "h-10",
};

const LOGO_H: Record<BozorliiiLogoSize, string> = {
  xs: "h-10",
  sm: "h-12",
  md: "h-14",
  lg: "h-[4.5rem]",
};

type Props = {
  variant?: BozorliiiLogoVariant;
  size?: BozorliiiLogoSize;
  href?: string | null;
  showTagline?: boolean;
  badge?: string;
  framed?: boolean;
  className?: string;
};

function DomainCapsule({ label, size }: { label: string; size: BozorliiiLogoSize }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100",
        "px-1.5 py-px font-semibold leading-none text-slate-600",
        size === "xs" ? "text-[9px]" : "text-[10px]",
        !label.startsWith(".") && "uppercase tracking-[0.12em]",
      )}
    >
      {label}
    </span>
  );
}

function BrandImage({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={cn("w-auto max-w-none object-contain object-left", className)}
      priority={false}
    />
  );
}

export function BozorliiiLogo({
  variant = "full",
  size = "md",
  href = "/",
  showTagline = false,
  badge,
  framed = false,
  className,
}: Props) {
  const capsuleLabel = badge?.trim() ?? "";

  const lockup = (
    <div className={cn("group/logo inline-flex max-w-full items-center gap-2", className)}>
      {variant === "icon" ? (
        <BrandImage src={BRAND.assets.icon} alt={BRAND.name} className={ICON_H[size]} width={141} height={141} />
      ) : null}

      {variant === "wordmark" ? (
        <BrandImage
          src={showTagline ? BRAND.assets.logo : BRAND.assets.wordmarkCompact}
          alt={BRAND.shortName}
          className={cn(showTagline ? LOGO_H[size] : WORDMARK_H[size], !showTagline && "max-w-[min(100%,9.5rem)] sm:max-w-[11rem]")}
          width={showTagline ? 1779 : 593}
          height={showTagline ? 442 : 128}
        />
      ) : null}

      {variant === "full" ? (
        <BrandImage
          src={showTagline ? BRAND.assets.logo : BRAND.assets.logoLockup}
          alt={BRAND.name}
          className={cn(
            showTagline ? LOGO_H[size] : WORDMARK_H[size],
            showTagline ? "max-w-[min(100%,14rem)]" : "max-w-[min(100%,9.5rem)] sm:max-w-[11rem]",
          )}
          width={showTagline ? 1779 : 593}
          height={showTagline ? 442 : 128}
        />
      ) : null}

      {capsuleLabel ? <DomainCapsule label={capsuleLabel} size={size} /> : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/35 focus-visible:ring-offset-2"
        aria-label={BRAND.name}
      >
        {lockup}
      </Link>
    );
  }

  return lockup;
}

/** @deprecated Use BozorliiiLogo */
export const TopdimLogo = BozorliiiLogo;
