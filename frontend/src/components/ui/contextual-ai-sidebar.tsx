"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import type { Product } from "@/types";

type ContextualAiSidebarProps = {
  product: Product;
};

export function ContextualAiSidebar({ product }: ContextualAiSidebarProps) {
  const color = product.category?.toLowerCase().includes("ko'k") ? "moviy" : product.category?.toLowerCase().includes("qora") ? "to'q" : "yengil";
  const material = product.category?.toLowerCase().includes("charm") ? "charm" : "paxta";
  const block = product.shop.floor || "42-blok";

  return (
    <aside className="rounded-3xl border border-electric-500/20 bg-electric-500/5 p-5">
      <div className="mb-3 flex items-center gap-2 text-electric-500">
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">Nega sizga yoqadi</span>
      </div>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm leading-relaxed text-ink-700">
        Siz avval {color} rang va {material} mato qidirgan edingiz. Bu model {block}dagi do'konlarda ko'p sotilgan va
        o'lcham jadvalida o'rtacha fit uchun mos.
      </motion.p>
    </aside>
  );
}
