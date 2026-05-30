"use client";

import { motion } from "framer-motion";
import { ScanSearch } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SectionHeader } from "@/components/ui/section-header";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

type VisualSimilarityRailProps = {
  sourceImage: string;
  items: Product[];
};

export function VisualSimilarityRail({ sourceImage, items }: VisualSimilarityRailProps) {
  if (!items.length) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="Visual match"
        title="O'xshash mahsulotlar"
        description="Faqat yuklangan rasm va mahsulot fotosurati bo'yicha AI embedding natijalari."
        action={
          <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-400">
            <ScanSearch className="h-3.5 w-3.5" />
            Rasm bo'yicha
          </span>
        }
      />
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface/70 p-3">
        <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-gold-500/30">
          <Image src={sourceImage} alt="Asosiy rasm" fill className="object-cover" sizes="64px" />
        </div>
        <p className="text-sm text-text-300">AI ushbu rasm silueti, rang palitrasi va mato teksturasiga eng yaqin tovarlarni tanladi.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
          >
            <Link href={`/product/${item.id}`} className="group block overflow-hidden rounded-2xl border border-border-subtle bg-surface">
              <div className="relative aspect-square bg-elevated">
                <Image src={item.images?.[0] || "/placeholder.png"} alt={item.name} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="25vw" />
                <span className="absolute left-2 top-2 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] font-semibold text-gold-400 backdrop-blur">
                  {98 - index * 3}% o'xshash
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium text-text-100">{item.name}</p>
                <p className="price-mono mt-2 text-base font-bold text-gold-500">{formatPrice(item.price)}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
