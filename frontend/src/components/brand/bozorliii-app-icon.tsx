"use client";

import Image from "next/image";

import { BRAND } from "@/components/brand/brand-tokens";
import { cn } from "@/lib/utils";

type BozorliiiAppIconProps = {
  className?: string;
  interactive?: boolean;
  "aria-label"?: string;
};

/** @deprecated Prefer BozorliiiLogo variant="icon" */
export function BozorliiiAppIcon({
  className,
  "aria-label": ariaLabel = "Bozorlii",
}: BozorliiiAppIconProps) {
  return (
    <Image
      src={BRAND.assets.icon}
      alt={ariaLabel}
      width={141}
      height={141}
      unoptimized
      className={cn("h-9 w-9 shrink-0 object-contain", className)}
    />
  );
}
