"use client";

import Image from "next/image";
import { useState } from "react";

import {
  hasReliableProductImage,
  isLocalDevMedia,
  isUnreliableProductImage,
  PLACEHOLDER_CLOTHING,
  productImage,
  shouldUnoptimizeProductImage,
} from "@/lib/media";
import { cn } from "@/lib/utils";

type ProductPinImageProps = {
  images?: string[] | null;
  alt: string;
  priority?: boolean;
  aspectClass: string;
  sizes?: string;
};

export function ProductPinImage({
  images,
  alt,
  priority = false,
  aspectClass,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
}: ProductPinImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = productImage(images);
  const raw0 = images?.[0] ?? "";
  const usePlaceholder = failed || !hasReliableProductImage(images) || isUnreliableProductImage(raw0);
  const unoptimized = shouldUnoptimizeProductImage(src);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl bg-neutral-100", aspectClass)}>
      {!loaded && !usePlaceholder ? (
        <div className="absolute inset-0 skeleton" aria-hidden />
      ) : null}
      {usePlaceholder ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-electric-500/10 via-white to-electric-400/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PLACEHOLDER_CLOTHING}
            alt={alt}
            className="h-[70%] w-[70%] object-contain opacity-95"
          />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          unoptimized={unoptimized}
          sizes={sizes}
          className={cn(
            "object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      )}
    </div>
  );
}
