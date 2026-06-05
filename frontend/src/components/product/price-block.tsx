"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";

import { useCurrency } from "@/components/providers/currency-provider";
import { getGroupPrice, GROUP_MIN_MEMBERS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type PriceMode = "single" | "group";

type PriceBlockProps = {
  price: number;
  mode: PriceMode;
  onModeChange: (mode: PriceMode) => void;
  className?: string;
};

/**
 * Unified single + group price card.
 * Group price is highlighted with a subtle electric-blue accent border + soft tint.
 */
export function PriceBlock({ price, mode, onModeChange, className }: PriceBlockProps) {
  const { formatPrice } = useCurrency();
  const groupPrice = getGroupPrice(price);
  const savings = Math.max(0, price - groupPrice);

  return (
    <motion.div
      layout
      className={cn("grid gap-3 sm:grid-cols-2", className)}
      role="radiogroup"
      aria-label="Narx variantlari"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "single"}
        onClick={() => onModeChange("single")}
        className={cn(
          "rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/40",
          mode === "single"
            ? "border-orange-400 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-card"
            : "border-orange-200 bg-amber-50/80 text-amber-900 hover:border-orange-300",
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Yakka narx</p>
        <p className="price-mono mt-2 text-2xl font-bold">{formatPrice(price)}</p>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === "group"}
        onClick={() => onModeChange("group")}
        className={cn(
          "relative rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/40",
          mode === "group"
            ? "border-sky-500/70 bg-sky-50 shadow-[0_0_0_4px_rgba(14,165,233,0.12)]"
            : "border-sky-300/40 bg-sky-50/60 hover:border-sky-400/60",
        )}
      >
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-electric-500">
          <Users className="h-3.5 w-3.5" />
          Guruh narxi · {GROUP_MIN_MEMBERS}+ kishi
        </p>
        <p className="price-mono mt-2 text-2xl font-bold text-electric-500">{formatPrice(groupPrice)}</p>
        {savings > 0 ? (
          <p className="mt-1 text-[11px] font-medium text-ink-500">
            {formatPrice(savings)} tejaysiz
          </p>
        ) : null}
      </button>
    </motion.div>
  );
}
