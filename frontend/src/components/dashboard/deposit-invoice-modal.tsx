"use client";

import { CreditCard, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

type Package = { id: string; name_uz: string; coins: number; amount_uzs: number };

type Props = {
  open: boolean;
  onClose: () => void;
  packages: Package[];
  onCheckout: (packageId: string, provider: "click") => void;
  loading?: boolean;
};

export function DepositInvoiceModal({ open, onClose, packages, onCheckout, loading }: Props) {
  const [selected, setSelected] = useState<string>("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-100">Coin to&apos;ldirish</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-400 hover:bg-canvas">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-2">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelected(pkg.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selected === pkg.id ? "border-gold-500/50 bg-gold-500/10" : "border-border-subtle"
              }`}
            >
              <p className="font-semibold text-text-100">{pkg.name_uz}</p>
              <p className="price-mono text-xl font-bold text-gold-600">{pkg.coins} coin</p>
              <p className="text-sm text-text-400">{formatNumber(pkg.amount_uzs)} so&apos;m</p>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2">
          <Button
            variant="secondary"
            leftIcon={<CreditCard className="h-4 w-4" />}
            disabled={!selected}
            isLoading={loading}
            onClick={() => selected && onCheckout(selected, "click")}
          >
            Click
          </Button>
        </div>
      </div>
    </div>
  );
}
