"use client";

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

  /* Inline gradient B icon + text */
  const logoImage = (
    <div className="inline-flex items-center" style={{ gap: `${8 * s}px` }}>
      <div
        className="flex shrink-0 items-center justify-center rounded-[9px] font-black text-white"
        style={{
          width: `${36 * s}px`,
          height: `${36 * s}px`,
          fontSize: `${18 * s}px`,
          background: "linear-gradient(135deg, #FF5A00 0%, #E91E8C 50%, #7B2FE4 100%)",
          boxShadow: `0 2px 10px rgba(233,30,140,${0.4 * s})`,
          lineHeight: 1,
        }}
      >
        B
      </div>
      <span
        className="font-black tracking-tight text-white"
        style={{ fontSize: `${22 * s}px`, lineHeight: 1 }}
      >
        Bozor
        <span
          style={{
            background: "linear-gradient(90deg, #E91E8C, #7B2FE4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          liii
        </span>
      </span>
    </div>
  );

  const iconBadge = (
    <div
      className="flex shrink-0 items-center justify-center rounded-[9px] font-black text-white"
      style={{
        width: `${36 * s}px`,
        height: `${36 * s}px`,
        fontSize: `${18 * s}px`,
        background: "linear-gradient(135deg, #FF5A00 0%, #E91E8C 50%, #7B2FE4 100%)",
        boxShadow: `0 2px 10px rgba(233,30,140,${0.4 * s})`,
        lineHeight: 1,
      }}
    >
      B
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
