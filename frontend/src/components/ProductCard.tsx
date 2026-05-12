import { Heart, Share2, Phone } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  variant?: "grid" | "list" | "compact" | "featured";
  aspectRatio?: "square" | "video";
  priority?: boolean;
  onBand?: (product: Product) => void;
  onOpen?: (product: Product) => void;
}

export function ProductCard({
  product,
  variant = "grid",
  aspectRatio = "square",
  priority = false,
  onBand,
  onOpen,
}: ProductCardProps) {
  const imageUrl = product.images?.[0] || "/placeholder.png";

  return (
    <div
      onClick={() => onOpen?.(product)}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-subtle bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-hover",
        variant === "compact" ? "max-w-[160px]" : "w-full"
      )}
    >
      {/* Image container */}
      <div
        className={cn(
          "relative w-full overflow-hidden bg-elevated",
          aspectRatio === "square" ? "aspect-square" : "aspect-[4/3]"
        )}
      >
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />

        {/* Hover Actions Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute right-2 top-2 flex translate-x-4 flex-col gap-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/80 text-text-100 backdrop-blur transition-colors hover:bg-gold-500 hover:text-canvas"
            onClick={(e) => {
              e.stopPropagation();
              // handle heart
            }}
          >
            <Heart className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/80 text-text-100 backdrop-blur transition-colors hover:bg-gold-500 hover:text-canvas"
            onClick={(e) => {
              e.stopPropagation();
              navigator.share?.({
                title: product.name,
                url: `${location.origin}/product/${product.id}`,
              });
            }}
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Availability Badge */}
        <div className="absolute bottom-2 left-2">
          {product.is_available ? (
            <span className="rounded-full bg-green/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              Mavjud
            </span>
          ) : (
            <span className="rounded-full bg-red/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              Sotilgan
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1 text-xs text-text-400">
          {product.category || "Kiyim"} • {product.shop.ipadrom || "Bozor"}
        </div>
        <h3 className="line-clamp-2 text-sm font-medium text-text-100">
          {product.name}
        </h3>

        <div className="my-3 h-px w-full bg-border-subtle" />

        <div className="mt-auto">
          <div className="price-mono text-lg font-bold text-gold-500">
            {formatPrice(product.price)}
          </div>
          <div className="mt-1 flex items-center text-xs text-text-300">
            <span className="truncate">
              ⭐ {product.shop.name}
            </span>
          </div>
        </div>

        {variant !== "compact" && (
          <Button
            variant="primary"
            size="sm"
            className="mt-3 w-full"
            leftIcon={<Phone className="h-3 w-3" />}
            onClick={(e) => {
              e.stopPropagation();
              onBand?.(product);
            }}
          >
            Band qilish
          </Button>
        )}
      </div>
    </div>
  );
}
