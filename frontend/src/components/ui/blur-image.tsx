"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

import { PLACEHOLDER_IMAGE, resolveMediaUrl, shouldUnoptimizeProductImage } from "@/lib/media";
import { cn } from "@/lib/utils";

type BlurImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
  wrapperClassName?: string;
};

export function BlurImage({ className, wrapperClassName, alt, onLoad, onError, src, unoptimized, ...props }: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolved = failed ? PLACEHOLDER_IMAGE : resolveMediaUrl(typeof src === "string" ? src : null);
  const useUnoptimized = unoptimized ?? shouldUnoptimizeProductImage(resolved);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-elevated via-slate-100 to-electric-500/10",
        wrapperClassName,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          loaded ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden
      >
        <div className="absolute inset-0 skeleton opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(10,124,255,0.12),transparent_55%)]" />
      </div>
      <Image
        {...props}
        src={resolved}
        unoptimized={useUnoptimized}
        alt={alt}
        className={cn(
          "transition-opacity duration-500 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
        onError={(event) => {
          if (!failed) {
            setFailed(true);
            setLoaded(false);
          }
          onError?.(event);
        }}
      />
    </div>
  );
}
