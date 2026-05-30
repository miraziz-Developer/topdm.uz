"use client";

import { Coins, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

type Props = {
  balance: number;
  onDeposit: () => void;
};

export function CrmBalanceWidget({ balance, onDeposit }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/10 via-surface to-surface p-5 shadow-elevated">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 ring-1 ring-gold-500/30">
          <Coins className="h-7 w-7 text-gold-600" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-700/80">Mavjud balans</p>
          <p className="price-mono text-4xl font-bold text-text-100">{formatNumber(balance)}</p>
          <p className="text-xs text-text-400">Bozor Coin — premium bannerlar uchun</p>
        </div>
      </div>
      <Button leftIcon={<Plus className="h-4 w-4" />} onClick={onDeposit}>
        Coin to&apos;ldirish
      </Button>
    </div>
  );
}
