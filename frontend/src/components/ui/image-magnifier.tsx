"use client";

import { useEffect, useRef, useState } from "react";

import { ProductImage } from "@/components/ui/product-image";
import { productImage } from "@/lib/media";
import { cn } from "@/lib/utils";

type ImageMagnifierProps = {
  /** Birinchi rasm yoki zanjor (ProductImage fallback). */
  images?: string[] | null;
  index?: number;
  /** @deprecated images ishlating */
  src?: string;
  alt: string;
  className?: string;
};

/** Do'kon rasmlari ko'pincha vertikal — kesmasdan to'liq ko'rsatish uchun clamp. */
function clampAspect(ratio: number): number {
  return Math.min(1.15, Math.max(0.52, ratio));
}

export function ImageMagnifier({ images, index = 0, src, alt, className }: ImageMagnifierProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState<number | null>(null);

  const candidates = images?.length ? images : src ? [src] : [];

  const zoomSrc = displaySrc ?? productImage(candidates, index);
  const frameAspect = imageAspect ? clampAspect(imageAspect) : 3 / 4;

  useEffect(() => {
    setDisplaySrc(null);
    setImageAspect(null);
  }, [index, candidates.join("|")]);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPosition({ x, y });
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full max-h-[min(78vh,680px)] overflow-hidden rounded-[1.75rem] bg-[#f0eeea] ring-1 ring-black/[0.06] shadow-[0_24px_64px_-28px_rgba(15,23,42,0.22)] sm:rounded-[2rem]",
        className,
      )}
      style={{ aspectRatio: frameAspect }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onMouseMove={onMove}
    >
      <ProductImage
        images={candidates}
        index={index}
        alt={alt}
        fill
        priority
        className="object-contain p-2 sm:p-3"
        sizes="(max-width: 768px) 100vw, 50vw"
        onLoadingComplete={(img) => {
          setDisplaySrc(img.currentSrc || img.src);
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setImageAspect(img.naturalWidth / img.naturalHeight);
          }
        }}
      />
      {active ? (
        <div
          className="pointer-events-none absolute h-28 w-28 rounded-full border-2 border-electric-500/70 shadow-hover"
          style={{ left: `calc(${position.x}% - 3.5rem)`, top: `calc(${position.y}% - 3.5rem)` }}
        />
      ) : null}
      {active && zoomSrc ? (
        <div className="pointer-events-none absolute right-4 top-4 hidden h-40 w-40 overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-modal md:block">
          <div
            className="h-full w-full bg-contain bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${zoomSrc})`,
              backgroundSize: "contain",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
