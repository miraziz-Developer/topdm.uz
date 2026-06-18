"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  PLACEHOLDER_CLOTHING,
  productImage,
  shouldUnoptimizeProductImage,
} from "@/lib/media";
import { cn } from "@/lib/utils";

type ProductImageProps = Omit<ImageProps, "src" | "alt"> & {
  images?: string[] | null;
  /** Mahsulot galereyasidan rasm indeksi (default: 0). */
  index?: number;
  alt: string;
  wrapperClassName?: string;
};

/**
 * Mahsulot rasmi — API yo‘llarini brauzerda yuklanadigan URL ga aylantiradi.
 * Birinchi rasm yuklanmasa keyingi nomzodlarni sinab ko‘radi.
 */
export function ProductImage({
  images,
  index = 0,
  alt,
  className,
  wrapperClassName,
  unoptimized,
  onError,
  ...props
}: ProductImageProps) {
  const candidates = useMemo(
    () =>
      (images ?? [])
        .map((row) => String(row ?? "").trim())
        .filter(Boolean),
    [images],
  );

  const [activeIndex, setActiveIndex] = useState(index);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setActiveIndex(index);
    setExhausted(false);
  }, [candidates.join("|"), index]);

  const resolvedSrc = exhausted
    ? PLACEHOLDER_CLOTHING
    : productImage(candidates, activeIndex);

  const useUnoptimized =
    unoptimized ??
    (shouldUnoptimizeProductImage(resolvedSrc) || resolvedSrc.startsWith("/brand/"));

  const image = (
    <Image
      {...props}
      key={`${resolvedSrc}-${activeIndex}`}
      src={resolvedSrc}
      alt={alt}
      unoptimized={useUnoptimized}
      className={className}
      onError={(event) => {
        const nextIndex = activeIndex + 1;
        if (!exhausted && nextIndex < candidates.length) {
          setActiveIndex(nextIndex);
          return;
        }
        if (!exhausted) setExhausted(true);
        onError?.(event);
      }}
    />
  );

  if (wrapperClassName) {
    return <div className={cn("relative overflow-hidden", wrapperClassName)}>{image}</div>;
  }

  return image;
}
