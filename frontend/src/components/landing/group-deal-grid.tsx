"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SectionHeader } from "@/components/ui/section-header";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

const GROUP_TARGETS = [3, 2, 4, 2];

type GroupDealGridProps = {
  products: Product[];
  loading?: boolean;
};

export function GroupDealGrid({ products, loading }: GroupDealGridProps) {
  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionHeader eyebrow="Do'stingiz bilan" title="Guruh chegirmasi" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-44 rounded-3xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!products.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader
        eyebrow="Do'stingiz bilan oling"
        title="Guruh chegirmasi"
        description="Telegram guruhidagi havola orqali kirgan xaridorlar uchun narx bir zumda tushadi."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {products.slice(0, 4).map((product, index) => {
          const target = GROUP_TARGETS[index % GROUP_TARGETS.length];
          const joined = Math.min(target - 1, Math.max(1, (product.view_count ?? 8) % target));
          const progress = Math.round((joined / target) * 100);
          const groupPrice = Math.round(product.price * (1 - 0.08 * target));

          return (
            <motion.article
              key={product.id}
              whileHover={{ scale: 1.01 }}
              className="overflow-hidden rounded-3xl border border-border-subtle bg-surface/80 p-4 shadow-card backdrop-blur"
            >
              <Link href={`/product/${product.id}`} className="flex gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-elevated">
                  <Image
                    src={product.images?.[0] || "/placeholder.png"}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-gold-500/10 px-2.5 py-1 text-xs font-medium text-gold-400">
                    <Users className="h-3.5 w-3.5" />
                    {target} kishi bilan
                  </div>
                  <h3 className="line-clamp-2 text-base font-semibold text-text-100">{product.name}</h3>
                  <p className="mt-1 text-xs text-text-400">{product.shop.name}</p>
                  <motion.div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-text-300">
                      <span>{joined}/{target} do'st qo'shildi</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-elevated">
                      <motion.div
                        className="h-full rounded-full bg-gradient-gold"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </motion.div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="price-mono text-lg font-bold text-gold-500">{formatPrice(groupPrice)}</span>
                    <span className="text-sm text-text-400 line-through">{formatPrice(product.price)}</span>
                  </div>
                </div>
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
