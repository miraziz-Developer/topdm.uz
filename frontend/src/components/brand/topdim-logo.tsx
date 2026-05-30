import Link from "next/link";

import { BRAND } from "@/components/brand/brand-tokens";
import { cn } from "@/lib/utils";

export type TopdimLogoVariant = "icon" | "wordmark" | "full";
export type TopdimLogoSize = "xs" | "sm" | "md" | "lg";

const ICON_PX: Record<TopdimLogoSize, number> = { xs: 28, sm: 36, md: 44, lg: 56 };
const FULL_W: Record<TopdimLogoSize, number> = { xs: 120, sm: 148, md: 176, lg: 220 };
const FULL_H: Record<TopdimLogoSize, number> = { xs: 28, sm: 34, md: 40, lg: 48 };

type Props = {
  variant?: TopdimLogoVariant;
  size?: TopdimLogoSize;
  href?: string | null;
  showTagline?: boolean;
  badge?: string;
  className?: string;
};

export function TopdimLogo({
  variant = "full",
  size = "md",
  href = "/",
  showTagline = false,
  badge,
  className,
}: Props) {
  const src =
    variant === "icon"
      ? BRAND.assets.icon
      : variant === "wordmark"
        ? BRAND.assets.wordmark
        : BRAND.assets.logo;

  const w = variant === "full" ? FULL_W[size] : variant === "wordmark" ? FULL_W[size] * 0.85 : ICON_PX[size];
  const h = variant === "full" ? FULL_H[size] : variant === "wordmark" ? FULL_H[size] * 0.55 : ICON_PX[size];

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={BRAND.name}
      width={w}
      height={h}
      className={cn("block shrink-0", className)}
      style={{ width: w, height: h }}
    />
  );

  const content = (
    <div className={cn("inline-flex flex-col gap-0.5")}>
      <div className="inline-flex items-center gap-2">
        {img}
        {badge ? (
          <span className="rounded-full bg-electric-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-electric-500">
            {badge}
          </span>
        ) : null}
      </div>
      {showTagline ? (
        <span className="text-[10px] font-medium tracking-wide text-text-400 sm:text-xs">{BRAND.tagline}</span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/40"
      >
        {content}
      </Link>
    );
  }

  return content;
}
