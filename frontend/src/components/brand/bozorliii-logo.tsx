"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export type BozorliiiLogoVariant = "icon" | "wordmark" | "full";
export type BozorliiiLogoSize = "xs" | "sm" | "md" | "lg";

const ICON_SIZE: Record<BozorliiiLogoSize, string> = {
  xs: "h-7 w-7 rounded-[8px] text-[15px]",
  sm: "h-8 w-8 rounded-[9px] text-[17px]",
  md: "h-10 w-10 rounded-[11px] text-[19px]",
  lg: "h-12 w-12 rounded-[13px] text-[22px]",
};

const TEXT_SIZE: Record<BozorliiiLogoSize, string> = {
  xs: "text-[15px]",
  sm: "text-[17px]",
  md: "text-[20px]",
  lg: "text-[24px]",
};

const BADGE_SIZE: Record<BozorliiiLogoSize, string> = {
  xs: "text-[8px] px-1.5 py-px",
  sm: "text-[9px] px-1.5 py-px",
  md: "text-[10px] px-2 py-0.5",
  lg: "text-[11px] px-2 py-0.5",
};

const TAGLINE_SIZE: Record<BozorliiiLogoSize, string> = {
  xs: "text-[7px]",
  sm: "text-[8px]",
  md: "text-[9px]",
  lg: "text-[10px]",
};

type Props = {
  variant?: BozorliiiLogoVariant;
  size?: BozorliiiLogoSize;
  href?: string | null;
  showTagline?: boolean;
  badge?: string;
  framed?: boolean;
  theme?: "light" | "dark";
  className?: string;
};

export function BozorliiiLogo({
  variant = "full",
  size = "md",
  href = "/",
  showTagline = false,
  badge,
  framed = false,
  theme = "light",
  className,
}: Props) {
  const capsuleLabel = badge?.trim() ?? "";
  const onDark = theme === "dark";

  const lockup = (
    <div
      className={cn(
        "inline-flex items-center gap-2.5",
        framed && (onDark
          ? "rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm"
          : "rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200 shadow-sm"),
        className,
      )}
    >
      {/* Gradient icon — orange → pink → purple */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center font-black text-white select-none",
          "shadow-[0_2px_12px_rgba(233,30,140,0.45)]",
          ICON_SIZE[size],
        )}
        style={{
          background: "#003366",
        }}
        aria-hidden="true"
      >
        B
      </div>

      {/* Wordmark + tagline */}
      {variant !== "icon" ? (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={cn(
              "font-black tracking-tight leading-none",
              TEXT_SIZE[size],
              onDark ? "text-white" : "text-[#0B0B0B]",
            )}
          >
            <span>Bozor</span>
            <span style={{ color: "#003366" }}>
              liii
            </span>
          </span>
          {showTagline ? (
            <span
              className={cn(
                "mt-0.5 font-bold tracking-[0.15em] uppercase",
                TAGLINE_SIZE[size],
                onDark ? "text-white/50" : "text-slate-400",
              )}
            >
              INNOVATSION BOZOR PLATFORMASI
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Badge */}
      {capsuleLabel ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border font-bold leading-none uppercase tracking-wide",
            onDark
              ? "border-pink-400/30 bg-pink-500/15 text-pink-300"
              : "border-pink-200 bg-pink-50 text-pink-600",
            BADGE_SIZE[size],
          )}
        >
          {capsuleLabel}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40 focus-visible:ring-offset-2"
        aria-label="Bozorliii"
      >
        {lockup}
      </Link>
    );
  }

  return lockup;
}

/** @deprecated Use BozorliiiLogo */
export const TopdimLogo = BozorliiiLogo;
