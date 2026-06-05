"use client";

import { formatUzs, type PriceBreakdown } from "@/lib/premium-market";
import { marketPanel } from "@/components/market/market-ui";

type Props = {
  mode: "china" | "local";
  pricing: PriceBreakdown;
  productLabel?: string;
  productAmount?: number;
  cargoLabel?: string;
};

export function PremiumPriceCard({ mode, pricing, productLabel, productAmount, cargoLabel }: Props) {
  const productLine =
    productAmount ??
    (mode === "china" ? pricing.base_price_uzs + pricing.margin_amount_uzs : pricing.base_price_uzs);

  return (
    <div className={marketPanel}>
      <p className="text-xs font-bold uppercase tracking-widest text-electric-500">Narx tafsiloti</p>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-3 text-ink-700">
          <span>{productLabel ?? (mode === "china" ? "Tovar (ustama bilan)" : "Tovar narxi")}</span>
          <span className="font-semibold text-ink-900">{formatUzs(productLine)}</span>
        </div>
        {mode === "china" ? (
          <div className="flex justify-between gap-3 text-text-400">
            <span>Ustama ({pricing.margin_pct}%)</span>
            <span className="text-electric-500">+{formatUzs(pricing.margin_amount_uzs)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 text-ink-700">
          <span>{cargoLabel ?? (mode === "china" ? "Xitoydan kargo" : "Shahar ichida kuryer")}</span>
          <span className="font-semibold text-ink-900">{formatUzs(pricing.cargo_uzs)}</span>
        </div>
      </div>
      <div className="mt-6 border-t border-border-subtle pt-6">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-text-400">
          Yakuniy narx
        </p>
        <p className="mt-2 text-center text-3xl font-black tracking-tight text-electric-500">
          {formatUzs(pricing.total_price_uzs)}
        </p>
      </div>
    </div>
  );
}
