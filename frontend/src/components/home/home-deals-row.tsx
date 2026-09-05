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
      className={`mx-auto max-w-7xl px-2.5 py-3 min-[360px]:px-4 sm:px-6 sm:py-4 bg-gradient-to-r ${cfg.bg}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-border-subtle min-[360px]:h-9 min-[360px]:w-9 ${cfg.accent}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-ink-900">{cfg.title}</h2>
            <p className="truncate text-[10px] text-ink-500 min-[360px]:text-[11px]">{cfg.subtitle}</p>
          </div>
        </div>
        <Link href={cfg.href} className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-1 text-[11px] font-bold text-electric-500 hover:underline min-[360px]:text-xs" aria-label={`${cfg.title}: hammasini ko'rish`}>
          Hammasi →
        </Link>
      </div>

      <div className="mobile-scroll-row scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory" aria-label={cfg.title}>
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
