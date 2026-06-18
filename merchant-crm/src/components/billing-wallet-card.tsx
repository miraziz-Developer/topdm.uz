"use client";

import { Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatSom, walletBalanceUzs, type MerchantWalletLike } from "@/lib/money";

type Props = {
  wallet: MerchantWalletLike | null;
  onTopUp: () => void;
  compact?: boolean;
};

export function BillingWalletCard({ wallet, onTopUp, compact }: Props) {
  const balance = walletBalanceUzs(wallet);

  if (compact) {
    return (
      <div className="crm-surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-400">Reklama balansi</p>
          <p className="text-xl font-bold tabular-nums text-text-100">{formatSom(balance)}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onTopUp}>
          To&apos;ldirish
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="crm-surface-card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-electric-500/10 text-electric-600">
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-400">Reklama balansi</p>
            <p className="text-3xl font-bold tabular-nums text-text-100">{formatSom(balance)}</p>
            <p className="text-sm text-text-400">Banner va mahsulot boost — hammasi so&apos;mda</p>
          </div>
        </div>
        <Button
          type="button"
          className="border-0 bg-electric-500 text-white hover:bg-electric-600"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={onTopUp}
        >
          Balans to&apos;ldirish
        </Button>
      </div>

      {!compact ? (
        <div className="crm-surface-card p-4 sm:p-5">
          <p className="text-sm font-semibold text-text-100">Qanday ishlaydi?</p>
          <ol className="mt-3 space-y-2 text-sm text-text-400">
            <li>1. Click orqali balansni so&apos;m da to&apos;ldirasiz.</li>
            <li>2. Bosh sahifa banneri yoki mahsulot boost — narx so&apos;mda ko&apos;rinadi.</li>
            <li>3. To&apos;lov shu balansdan yechiladi — tanga/coin yo&apos;q.</li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}
