"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";

import { MerchantBillingStatusCard } from "@/components/dashboard/merchant-billing-status-card";
import { MerchantSettlementCard } from "@/components/merchant-settlement-card";
import { getJson } from "@/lib/api";

interface Revenue {
  period_days: number;
  merchant_earnings_uzs?: number;
  customer_sales_uzs?: number;
  markup_pct?: number;
  gross_revenue_uzs: number;
  order_count: number;
  lead_count: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n));
}

export function MerchantFinancePanel() {
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<Revenue>("/billing/revenue?days=30")
      .then(setRevenue)
      .catch(() => setRevenue(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="crm-surface-card border border-emerald-500/20 bg-emerald-500/[0.04] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-100">Bu bo&apos;lim — savdo va pul</p>
            <p className="mt-1 text-sm leading-relaxed text-text-400">
              Buyurtmalardan tushgan daromad, kartaga yechish va platforma qarzi shu yerda. Reklama (boost/banner) —{" "}
              <Link href="/dashboard/billing?tab=ads" className="font-semibold text-electric-600 hover:underline">
                Reklama
              </Link>{" "}
              bo&apos;limida.
            </p>
          </div>
        </div>
      </section>

      <MerchantSettlementCard />

      <MerchantBillingStatusCard />

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : revenue ? (
        <section className="crm-surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-electric-500" />
            <h2 className="text-lg font-bold text-text-100">30 kunlik savdo</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Sizning savdongiz",
                hint: "Mahsulot narxlaringiz bo'yicha",
                value: `${fmt(revenue.merchant_earnings_uzs ?? revenue.gross_revenue_uzs)} so'm`,
              },
              {
                label: "Buyurtmalar",
                hint: `${revenue.period_days} kun`,
                value: String(revenue.order_count),
              },
              {
                label: "Murojaatlar",
                hint: "Leadlar",
                value: String(revenue.lead_count),
              },
              ...(revenue.customer_sales_uzs &&
              revenue.customer_sales_uzs > (revenue.merchant_earnings_uzs ?? 0)
                ? [
                    {
                      label: "Mijoz to'ladi",
                      hint: `+${revenue.markup_pct ?? 15}% ustama`,
                      value: `${fmt(revenue.customer_sales_uzs)} so'm`,
                    },
                  ]
                : []),
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-border-subtle bg-canvas/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-400">{kpi.label}</p>
                <p className="mt-1 text-xl font-black tabular-nums text-text-100">{kpi.value}</p>
                <p className="mt-0.5 text-[11px] text-text-400">{kpi.hint}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-text-400">
            Mijoz narxi = sizning narxingiz + platforma ustamasi ({revenue.markup_pct ?? 15}%). Ustama sizning
            &laquo;foyda&raquo; qatoringizga kirmaydi — faqat mijoz to&apos;loviga qo&apos;shiladi.
          </p>
        </section>
      ) : null}

      <section className="crm-surface-card p-5 sm:p-6">
        <h3 className="font-bold text-text-100">Qisqa qoidalar</h3>
        <ul className="mt-3 space-y-2 text-sm text-text-400">
          <li className="flex gap-2">
            <span className="text-electric-500">•</span>
            <span>
              <strong className="text-text-200">Click to&apos;lov</strong> — mijoz olib ketgach, pul yechib olish
              mumkin bo&apos;ladi (escrow tugagach).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-electric-500">•</span>
            <span>
              <strong className="text-text-200">Naqd / terminal</strong> — pul sizda; platforma ustamasi qarz
              balansiga yoziladi.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-electric-500">•</span>
            <span>
              <strong className="text-text-200">Reklama balansi</strong> savdo pulidan alohida — boost va banner uchun.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
