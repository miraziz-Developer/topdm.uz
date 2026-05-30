"use client";

import { MAP_MARKETS } from "@/lib/map/market-catalog";
import { cn } from "@/lib/utils";

type MarketSelectorProps = {
  value: string;
  onChange: (slug: string) => void;
  className?: string;
};

export function MarketSelector({ value, onChange, className }: MarketSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {MAP_MARKETS.map((market) => {
        const active = market.slug === value;
        return (
          <button
            key={market.slug}
            type="button"
            onClick={() => onChange(market.slug)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border-electric-500 bg-electric-500 text-white shadow-sm"
                : "border-border-subtle bg-white/90 text-ink-700 hover:border-electric-500/40",
            )}
          >
            {market.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
