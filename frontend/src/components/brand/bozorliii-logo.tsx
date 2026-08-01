"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type BozorliiiLogoVariant = "icon" | "wordmark" | "full";
export type BozorliiiLogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<BozorliiiLogoSize, { scale: number }> = {
  xs: { scale: 0.55 },
  sm: { scale: 0.75 },
  md: { scale: 1 },
  lg: { scale: 1.4 },
  xl: { scale: 2 },
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

export function BozorliiiLogo({
  variant = "full",
  size = "md",
  href = "/",
  showTagline = false,
  badge,
  framed = false,
  className,
}: Props) {
  const s = SIZE[size].scale;
  const capsuleLabel = badge?.trim() ?? "";

  /* Logo image rendered from /logo.png */
  const logoImage = (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: `${120 * s}px`,
        height: `${44 * s}px`,
      }}
    >
      <Image
        src="/logo.png"
        alt="Bozorliii"
        fill
        className="object-contain object-center"
        priority
        sizes={`${Math.round(120 * s)}px`}
      />
    </div>
  );

  const iconBadge = (
    <div
      className="relative flex items-center justify-center overflow-hidden"
      style={{
        width: `${40 * s}px`,
        height: `${40 * s}px`,
      }}
    >
      <Image
        src="/logo.png"
        alt="Bozorliii"
        fill
        className="object-contain object-center"
        priority
        sizes={`${Math.round(40 * s)}px`}
      />
    </div>
  );

  const lockup = (
    <div
      className={cn(
        "inline-flex items-center",
        framed && "rounded-3xl bg-white px-4 py-2.5 ring-1 ring-slate-200/60 shadow-sm",
        className,
      )}
      style={{ gap: `${10 * s}px` }}
    >
      {variant === "icon" ? iconBadge : logoImage}
      {variant !== "icon" && capsuleLabel ? (
        <span
          className="inline-flex shrink-0 items-center rounded-md border font-bold tracking-wide"
          style={{
            fontSize: `${10 * s}px`,
            padding: `${2 * s}px ${7 * s}px`,
            borderColor: "#e2e8f0",
            background: "#f8fafc",
            color: "#64748b",
          }}
        >
          {capsuleLabel}
        </span>
      ) : null}
      {showTagline ? (
        <span
          className="font-semibold tracking-[0.15em] uppercase"
          style={{
            fontSize: `${9 * s}px`,
            marginTop: `${3 * s}px`,
            color: "#003366",
          }}
        >
          INNOVATSIYON BOZOR PLATFORMASI
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366]/30 focus-visible:ring-offset-2 rounded-2xl" aria-label="Bozorliii">
        {lockup}
      </Link>
    );
  }

  return lockup;
}

export const TopdimLogo = BozorliiiLogo;
