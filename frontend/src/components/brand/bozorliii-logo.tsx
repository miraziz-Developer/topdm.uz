"use client";

import Link from "next/link";

import { BozorliiiAppIcon } from "@/components/brand/bozorliii-app-icon";
import { BRAND } from "@/components/brand/brand-tokens";
import { cn } from "@/lib/utils";

export type BozorliiiLogoVariant = "icon" | "wordmark" | "full";
export type BozorliiiLogoSize = "xs" | "sm" | "md" | "lg";

const ICON_CLASS: Record<BozorliiiLogoSize, string> = {
  xs: "h-8 w-8",
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-11 w-11",
};

const WORD_CLASS: Record<BozorliiiLogoSize, string> = {
  xs: "text-[15px]",
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

type Props = {
  variant?: BozorliiiLogoVariant;
  size?: BozorliiiLogoSize;
  href?: string | null;
  showTagline?: boolean;
  /** Optional capsule (e.g. "CRM"). Omit for icon + wordmark only. */
  badge?: string;
  framed?: boolean;
  className?: string;
};

function DomainCapsule({ label, size }: { label: string; size: BozorliiiLogoSize }) {
  const isDomain = label.startsWith(".");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100",
        "px-1.5 py-px font-semibold leading-none text-slate-600",
        "transition-colors duration-200 group-hover/logo:border-slate-300 group-hover/logo:bg-slate-50",
        size === "xs" ? "text-[9px]" : "text-[10px]",
        isDomain && "font-medium tracking-[0.06em]",
        !isDomain && "uppercase tracking-[0.12em]",
      )}
    >
      {label}
    </span>
  );
}

function Wordmark({ size, className }: { size: BozorliiiLogoSize; className?: string }) {
  return (
    <span
      className={cn(
        "font-sans font-bold leading-none tracking-tight text-zinc-950",
        "transition-colors duration-200 group-hover/logo:text-slate-900",
        WORD_CLASS[size],
        className,
      )}
    >
      {BRAND.shortName}
    </span>
  );
}

function LogoRow({
  variant,
  size,
  capsuleLabel,
}: {
  variant: BozorliiiLogoVariant;
  size: BozorliiiLogoSize;
  capsuleLabel: string;
}) {
  const showIcon = variant === "icon" || variant === "full";
  const showWord = variant === "wordmark" || variant === "full";

  return (
    <span className="inline-flex min-w-0 flex-row items-center space-x-3">
      {showIcon ? <BozorliiiAppIcon className={ICON_CLASS[size]} /> : null}
      {showWord ? <Wordmark size={size} /> : null}
      {capsuleLabel ? <DomainCapsule label={capsuleLabel} size={size} /> : null}
    </span>
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
    <div
      className={cn(
        "group/logo inline-flex max-w-full",
        showTagline ? "flex-col gap-1" : "flex-row items-center",
        framed && "rounded-2xl bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200",
        className,
      )}
    >
      <LogoRow variant={variant} size={size} capsuleLabel={capsuleLabel} />

      {showTagline ? (
        <span className="pl-0.5 text-[10px] font-medium tracking-wide text-slate-600 sm:pl-[calc(2.25rem+0.75rem)]">
          {BRAND.tagline}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-2"
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
