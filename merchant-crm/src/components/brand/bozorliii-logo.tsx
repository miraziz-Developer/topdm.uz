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

  /* Icon: navy B badge */
  const icon = (
    <div
      className="flex shrink-0 items-center justify-center font-black text-white select-none rounded-xl"
      style={{
        width: `${40 * s}px`,
        height: `${40 * s}px`,
        fontSize: `${22 * s}px`,
        background: "#003366",
        boxShadow: "0 2px 12px rgba(0,51,102,0.35)",
      }}
      aria-hidden="true"
    >
      B
    </div>
  );

  /* Wordmark: BoZorlIII with three dots above "lii" */
  const wordmark = (
    <span className="inline-flex items-baseline font-black leading-none select-none" style={{ fontSize: `${24 * s}px` }}>
      <span className="text-[#0a0a0a]">BoZor</span>
      <span className="relative text-[#0a0a0a]">
        {/* Three colourful dots */}
        <span className="absolute left-0 right-0 -top-[1px] flex justify-center gap-[3px]">
          <span
            className="inline-block rounded-full"
            style={{
              width: `${6 * s}px`,
              height: `${6 * s}px`,
              background: "#003366",
            }}
          />
          <span
            className="inline-block rounded-full"
            style={{
              width: `${6 * s}px`,
              height: `${6 * s}px`,
              background: "#f59e0b",
            }}
          />
          <span
            className="inline-block rounded-full"
            style={{
              width: `${6 * s}px`,
              height: `${6 * s}px`,
              background: "#f97316",
            }}
          />
        </span>
        lI
      </span>
      <span className="text-[#0a0a0a]">II</span>
    </span>
  );

  const brandText = (
    <div className="flex flex-col justify-center leading-none">
      <div className="flex items-baseline gap-1.5">
        {variant !== "icon" ? wordmark : null}
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
      </div>
      {showTagline ? (
        <span
          className="font-semibold tracking-[0.15em] uppercase"
          style={{
            fontSize: `${9 * s}px`,
            marginTop: `${3 * s}px`,
            color: "#003366",
          }}
        >
          INNOVATSION BOZOR PLATFORMASI
        </span>
      ) : null}
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
      {icon}
      {variant !== "icon" ? brandText : null}
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
