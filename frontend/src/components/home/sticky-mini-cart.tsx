"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag, X } from "lucide-react";

import { useCurrency } from "@/components/providers/currency-provider";
import { SALES } from "@/components/brand/sales-ui";
import { ProductImage } from "@/components/ui/product-image";
import { useFabDockItem, useFabDockPanel } from "@/components/ui/action-fab-dock";
import { cartLineImages } from "@/lib/cart-images";
import { cn } from "@/lib/utils";
import { productPriceUzs } from "@/lib/product-price";
import { useCartStore } from "@/stores/cart-store";
import { usePathname } from "next/navigation";

export function StickyMiniCart() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const lines = useCartStore((s) => s.lines);
  const totalItems = useCartStore((s) => s.totalItems());
  const { formatPrice } = useCurrency();

  useEffect(() => setMounted(true), []);

  const subtotal = lines.reduce(
    (sum, line) => sum + productPriceUzs(line.product) * line.quantity,
    0,
  );

  const hidden =
    !mounted ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/reels") ||
    pathname.startsWith("/china");

  useFabDockItem({
    id: "cart",
    order: 10,
    label: "Savat",
    shortLabel: "Savat",
    icon: <ShoppingBag className="h-5 w-5" />,
    badge: totalItems,
    hidden: hidden || totalItems === 0,
    onClick: () => setCollapsed(false),
  });

  useFabDockPanel("cart", !collapsed && totalItems > 0);

  if (hidden) return null;

  if (collapsed || totalItems === 0) {
    return null;
  }

  return (
    <aside
      className={cn(
        SALES.panel,
        "pointer-events-auto fixed right-4 top-24 z-40 flex max-h-[calc(100dvh-7rem)] w-[min(260px,calc(100vw-2rem))] flex-col backdrop-blur-md",
      )}
      aria-label="Savat"
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-electric-500" />
          <span className="text-sm font-bold text-ink-900">Savat ({totalItems})</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-full p-1 text-ink-400 hover:bg-canvas hover:text-ink-800"
          aria-label="Yig'ish"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[min(50vh,320px)] flex-1 overflow-y-auto px-3 py-2">
        {lines.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-ink-500">Savat bo&apos;sh — katalogdan qo&apos;shing</p>
        ) : (
          <ul className="space-y-2">
            {lines.slice(0, 6).map((line) => {
              const displayImages = cartLineImages(line.product, line.selectedOptions);
              const unit = productPriceUzs(line.product);
              return (
                <li
                  key={`${line.product.id}-${line.mode}-${line.selectedOptions?.color ?? ""}-${line.selectedOptions?.size ?? ""}`}
                  className="flex gap-2 rounded-xl bg-canvas/80 p-2"
                >
                  <ProductImage
                    images={displayImages}
                    alt={line.product.name}
                    fill
                    wrapperClassName="h-12 w-12 shrink-0 rounded-lg bg-elevated"
                    className="object-cover"
                    sizes="48px"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[11px] font-semibold text-ink-900">{line.product.name}</p>
                    <p className="text-[10px] text-ink-500">
                      {line.quantity} × {formatPrice(unit)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {lines.length > 6 ? (
          <p className="mt-1 text-center text-[10px] text-ink-400">+{lines.length - 6} yana</p>
        ) : null}
      </div>

      <div className="border-t border-border-subtle p-3">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-ink-500">Jami</span>
          <span className={cn(SALES.priceDeal, "font-bold text-ink-900")}>{formatPrice(subtotal)}</span>
        </div>
        <Link
          href={totalItems > 0 ? "/checkout" : "#catalog"}
          className={cn(
            "sales-cta sales-cta-pulse flex w-full items-center justify-center py-2.5 text-sm",
          )}
        >
          {totalItems > 0 ? "Buyurtma berish" : "Katalogga"}
        </Link>
      </div>
    </aside>
  );
}
