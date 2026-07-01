"use client";

import { CreditCard, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatSom } from "@/lib/money";

export type TopUpPackage = {
  id: string;
  name_uz: string;
  amount_uzs: number;
  coins?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  packages: TopUpPackage[];
  loading?: boolean;
  onCheckout: (packageId: string, provider: "click") => void;
};

export function BalanceTopUpModal({ open, onClose, packages, loading, onCheckout }: Props) {
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (open && packages.length && !selected) {
      setSelected(packages[0].id);
    }
  }, [open, packages, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border-subtle bg-surface p-5 shadow-elevated sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-100">Balans to&apos;ldirish</h3>
            <p className="mt-0.5 text-sm text-text-400">Click orqali — startup narxlari, so&apos;m da</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-text-400 hover:bg-canvas" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-2">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelected(pkg.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                selected === pkg.id
                  ? "border-electric-500/50 bg-electric-500/[0.08] ring-1 ring-electric-500/25"
                  : "border-border-subtle bg-canvas/50"
              }`}
            >
              <p className="font-semibold text-text-100">{pkg.name_uz}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-electric-600">{formatSom(pkg.amount_uzs)}</p>
              {pkg.coins ? (
                <p className="mt-0.5 text-xs text-text-400">
                  Reklama balansi: {formatSom(pkg.coins * 1_000)} · boost va banner uchun
                </p>
              ) : null}
            </button>
          ))}
          {!packages.length ? <p className="py-6 text-center text-sm text-text-400">Paketlar yuklanmoqda…</p> : null}
        </div>

        <div className="mt-4">
          <Button
            type="button"
            className="h-12 w-full border-0 bg-electric-500 text-white hover:bg-electric-600"
            disabled={!selected}
            isLoading={loading}
            onClick={() => selected && onCheckout(selected, "click")}
          >
            <CreditCard className="mr-1.5 h-4 w-4" />
            Click orqali to&apos;lash
          </Button>
        </div>
      </div>
    </div>
  );
}
