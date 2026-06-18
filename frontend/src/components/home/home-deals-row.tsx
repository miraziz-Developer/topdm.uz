"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Flame, Tag } from "lucide-react";

import { DealProductCard } from "@/components/home/deal-product-card";
import type { Product } from "@/types";

type Props = {
  variant: "lightning" | "clearance";
  products: Product[];
  loading?: boolean;
};

const CONFIG = {
  lightning: {
    title: "Tezkor takliflar",
    subtitle: "Eng ko'p ko'rilgan mahsulotlar",
    icon: Flame,
    href: "/search?q=trend",
    accent: "text-neon-500",
    bg: "from-neon-500/8 to-transparent",
  },
  clearance: {
    title: "Arzonlashgan",
    subtitle: "Eng yaxshi narxlar va chegirmalar",
    icon: Tag,
    href: "/search?sale_type=Chakana",
    accent: "text-amber-600",
    bg: "from-amber-500/8 to-transparent",
  },
} as const;

export function HomeDealsRow({ variant, products, loading }: Props) {
  const cfg = CONFIG[variant];
  const Icon = cfg.icon;

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r ${cfg.bg}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-border-subtle ${cfg.accent}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink-900">{cfg.title}</h2>
            <p className="text-[11px] text-ink-500">{cfg.subtitle}</p>
          </div>
        </div>
        <Link href={cfg.href} className="text-xs font-bold text-electric-500 hover:underline">
          Hammasi →
        </Link>
      </div>

      <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[220px] w-[140px] shrink-0 rounded-2xl sm:w-[152px]" />
            ))
          : products.length === 0
            ? (
                <p className="py-6 text-sm text-ink-500">Hozircha mahsulot yo&apos;q.</p>
              )
            : products.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.04, 0.24) }}
                >
                  <DealProductCard product={p} variant={variant} />
                </motion.div>
              ))}
      </div>
    </motion.section>
  );
}
