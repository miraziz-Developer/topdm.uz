"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getSimilarProducts } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/types";

export function PerfectMatchSidebar() {
  const lastAdded = useCartStore((state) => state.lastAdded);
  const clearLastAdded = useCartStore((state) => state.clearLastAdded);
  const [matches, setMatches] = useState<Product[]>([]);

  useEffect(() => {
    if (!lastAdded) return;
    const run = async () => {
      try {
        const response = await getSimilarProducts(lastAdded.id);
        setMatches((response.items || []).filter((item) => item.id !== lastAdded.id).slice(0, 3));
      } catch {
        setMatches([]);
      }
    };
    void run();
  }, [lastAdded]);

  return (
    <AnimatePresence>
      {lastAdded ? (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fab-safe-right fixed bottom-[calc(var(--app-bottom-nav-h)+4.5rem)] z-30 w-[min(calc(100vw-2rem),20rem)] rounded-3xl border border-border-subtle bg-white p-4 shadow-modal md:bottom-[6rem]"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-500">Perfect Match</p>
              <p className="text-sm font-medium text-ink-900">Savatchaga mos kombinatsiya</p>
            </div>
            <button type="button" onClick={clearLastAdded} className="text-xs text-ink-500">
              Yopish
            </button>
          </div>
          <div className="space-y-3">
            {matches.map((item) => (
              <Link key={item.id} href={`/product/${item.id}`} className="flex items-center gap-3 rounded-2xl border border-border-subtle p-2 transition hover:border-electric-500/40">
                <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-elevated">
                  <Image src={item.images?.[0] || "/placeholder.png"} alt={item.name} fill className="object-cover" sizes="56px" />
                </div>
                <div>
                  <p className="line-clamp-2 text-sm font-medium text-ink-900">{item.name}</p>
                  <p className="price-mono mt-1 text-sm font-bold text-neon-500">{formatPrice(item.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
