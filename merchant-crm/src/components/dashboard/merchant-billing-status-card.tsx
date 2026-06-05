"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getJson, postJson } from "@/lib/api";
import { cn } from "@/lib/utils";

type DebtStatus = {
  shop_id: string;
  debt_balance_uzs: number;
  is_blocked: boolean;
  block_threshold_uzs: number;
  amount_until_block_uzs: number;
  markup_pct: number;
};

function fmtUzs(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

export function MerchantBillingStatusCard() {
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState<DebtStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getJson<DebtStatus>("/billing/debt");
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const payNow = async () => {
    if (!status || status.debt_balance_uzs <= 0) {
      toast.message("Qarz balansi 0 — to'lov talab qilinmaydi.");
      return;
    }
    setPaying(true);
    try {
      const res = await postJson<{ debt_balance_uzs?: number; message?: string }>(
        "/billing/pay-debt",
        { amount_uzs: status.debt_balance_uzs },
      );
      toast.success(res.message ?? "To'lov qabul qilindi (demo: Click/Payme).");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "To'lov amalga oshmadi");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="skeleton h-40 rounded-3xl" />;
  }

  if (!status) {
    return null;
  }

  const blocked = status.is_blocked;
  const debt = status.debt_balance_uzs;
  const markup = status.markup_pct;

  return (
    <section
      className={cn(
        "crm-surface-card overflow-hidden border-2",
        blocked ? "border-red-500/40 bg-red-500/[0.04]" : "border-electric-500/25",
      )}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              blocked ? "bg-red-500/15 text-red-700" : "bg-electric-500/10 text-electric-600",
            )}
          >
            {blocked ? <AlertTriangle className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </span>
          <div>
            <h2 className="text-base font-bold text-text-100">Billing &amp; Account Status</h2>
            <p className="mt-1 text-xs text-text-400">
              Naqd/terminal buyurtmalarda platforma ustamasi ({markup}%) qarz balansiga yoziladi.
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <dt className="text-text-400">Joriy qarz:</dt>
                <dd className="font-bold tabular-nums text-text-100">{fmtUzs(debt)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <dt className="text-text-400">Hisob holati:</dt>
                <dd
                  className={cn(
                    "font-semibold",
                    blocked ? "text-red-700" : "text-emerald-700",
                  )}
                >
                  {blocked ? "BLOCKED due to unpaid debt" : "Active"}
                </dd>
              </div>
              {!blocked && debt > 0 ? (
                <p className="text-xs text-amber-800">
                  Bloklash chegara: {fmtUzs(status.block_threshold_uzs)} (
                  {fmtUzs(status.amount_until_block_uzs)} qoldi)
                </p>
              ) : null}
            </dl>
          </div>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0 gap-2 rounded-full px-6"
          disabled={paying || debt <= 0}
          onClick={() => void payNow()}
        >
          <CreditCard className="h-4 w-4" />
          {paying ? "To'lanmoqda…" : "Pay Now via Click/Payme"}
        </Button>
      </div>
    </section>
  );
}
