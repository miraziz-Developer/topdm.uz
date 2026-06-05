"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag, X } from "lucide-react";

import { useCurrency } from "@/components/providers/currency-provider";
import { getGroupPrice } from "@/lib/pricing";
import { productImage } from "@/lib/media";
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

  const subtotal = lines.reduce((sum, line) => {
    const unit =
      line.mode === "group"
        ? getGroupPrice(productPriceUzs(line.product))
        : productPriceUzs(line.product);
    return sum + unit * line.quantity;
  }, 0);

  const hidden =
    !mounted ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/reels");

  if (hidden) return null;

  if (collapsed || totalItems === 0) {
    if (totalItems === 0) return null;
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fab-safe-right fixed bottom-[calc(var(--app-bottom-nav-h)+var(--app-fab-stack-gap)+0.25rem)] z-40 hidden h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-white shadow-xl md:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] xl:flex"
        aria-label="Savatni ochish"
      >
        <ShoppingBag className="h-5 w-5" />
        {totalItems > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-neon-500 px-1 text-[10px] font-bold">
            {totalItems}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <aside
      className="pointer-events-auto fixed right-4 top-24 z-40 hidden max-h-[calc(100dvh-7rem)] w-[min(260px,calc(100vw-2rem))] flex-col rounded-2xl border border-border-subtle bg-white/95 shadow-elevated backdrop-blur-md xl:flex"
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
              const img = productImage(line.product.images);
              const unit =
                line.mode === "group"
                  ? getGroupPrice(productPriceUzs(line.product))
                  : productPriceUzs(line.product);
              return (
                <li key={`${line.product.id}-${line.mode}`} className="flex gap-2 rounded-xl bg-canvas/80 p-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-elevated">
                    <Image src={img} alt="" fill unoptimized className="object-cover" sizes="48px" />
                  </div>
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
          <span className="font-bold text-ink-900">{formatPrice(subtotal)}</span>
        </div>
        <Link
          href={totalItems > 0 ? "/checkout" : "#catalog"}
          className="flex w-full items-center justify-center rounded-xl bg-electric-500 py-2.5 text-sm font-bold text-white transition hover:bg-electric-400"
        >
          {totalItems > 0 ? "Buyurtma berish" : "Katalogga"}
        </Link>
      </div>
    </aside>
  );
}
